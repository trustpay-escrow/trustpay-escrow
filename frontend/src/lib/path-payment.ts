/**
 * Pure helpers for Stellar DEX path payments (Horizon `/paths/strict-send`).
 * Amounts are decimal strings/numbers in whole units (7-decimal Stellar precision).
 */
import { SUPPORTED_TOKENS } from '@/config/tokens';

export const SLIPPAGE_OPTIONS = [0.5, 1.0, 2.5] as const;
export type SlippagePct = (typeof SLIPPAGE_OPTIONS)[number];
export const DEFAULT_SLIPPAGE: SlippagePct = 1.0;
export const HIGH_PRICE_IMPACT_PCT = 3;

export interface PathAsset {
  code: string;
  /** Undefined for native XLM. */
  issuer?: string;
}

export interface PathRoute {
  sourceAmount: number;
  destinationAmount: number;
  /** Intermediate assets, excluding source and destination. */
  path: PathAsset[];
}

export interface PathQuote {
  route: PathRoute;
  sourceAmount: number;
  destinationAmount: number;
  /** Destination units received per source unit. */
  effectiveRate: number;
  /** Rate for a tiny probe amount, i.e. before the trade moves the market. */
  spotRate: number | null;
  priceImpactPct: number;
  hops: number;
}

export function getPathAsset(symbol: string): PathAsset | null {
  const token = SUPPORTED_TOKENS[symbol];
  if (!token) return null;
  if (symbol === 'XLM') return { code: 'XLM' };
  return token.classicIssuer ? { code: token.symbol, issuer: token.classicIssuer } : null;
}

const assetParam = (asset: PathAsset) => (asset.issuer ? `${asset.code}:${asset.issuer}` : 'native');

export function buildStrictSendUrl(
  horizonUrl: string,
  source: PathAsset,
  sourceAmount: number | string,
  destination: PathAsset
): string {
  const params = new URLSearchParams();
  if (source.issuer) {
    params.set('source_asset_type', source.code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12');
    params.set('source_asset_code', source.code);
    params.set('source_asset_issuer', source.issuer);
  } else {
    params.set('source_asset_type', 'native');
  }
  params.set('source_amount', Number(sourceAmount).toFixed(7));
  params.set('destination_assets', assetParam(destination));
  return `${horizonUrl.replace(/\/$/, '')}/paths/strict-send?${params.toString()}`;
}

interface HorizonPathRecord {
  source_amount?: string;
  destination_amount?: string;
  path?: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>;
}

export function parsePathRecords(payload: unknown): PathRoute[] {
  const records = (payload as { _embedded?: { records?: HorizonPathRecord[] } } | null)?._embedded?.records;
  if (!Array.isArray(records)) return [];
  return records.flatMap((r) => {
    const sourceAmount = Number(r.source_amount);
    const destinationAmount = Number(r.destination_amount);
    if (!Number.isFinite(sourceAmount) || !Number.isFinite(destinationAmount) || destinationAmount <= 0) return [];
    const path = (r.path ?? []).map((hop) =>
      hop.asset_type === 'native' ? { code: 'XLM' } : { code: hop.asset_code ?? '', issuer: hop.asset_issuer }
    );
    return [{ sourceAmount, destinationAmount, path }];
  });
}

export function pickBestRoute(routes: PathRoute[]): PathRoute | null {
  if (routes.length === 0) return null;
  // Highest output wins; fewer hops breaks ties (less fee/failure surface).
  return [...routes].sort(
    (a, b) => b.destinationAmount - a.destinationAmount || a.path.length - b.path.length
  )[0];
}

/** Worst acceptable output after slippage. */
export function applySlippage(destinationAmount: number, slippagePct: number): number {
  const pct = Math.min(100, Math.max(0, slippagePct));
  return Math.floor(destinationAmount * (1 - pct / 100) * 1e7) / 1e7;
}

export function computeRate(sourceAmount: number, destinationAmount: number): number {
  return sourceAmount > 0 ? destinationAmount / sourceAmount : 0;
}

/** How much worse the executed rate is than the spot rate, as a non-negative percentage. */
export function computePriceImpactPct(spotRate: number | null, effectiveRate: number): number {
  if (!spotRate || spotRate <= 0 || effectiveRate <= 0) return 0;
  return Math.max(0, ((spotRate - effectiveRate) / spotRate) * 100);
}

export function buildQuote(best: PathRoute, probe: PathRoute | null): PathQuote {
  const effectiveRate = computeRate(best.sourceAmount, best.destinationAmount);
  const spotRate = probe ? computeRate(probe.sourceAmount, probe.destinationAmount) : null;
  return {
    route: best,
    sourceAmount: best.sourceAmount,
    destinationAmount: best.destinationAmount,
    effectiveRate,
    spotRate,
    priceImpactPct: computePriceImpactPct(spotRate, effectiveRate),
    hops: best.path.length,
  };
}

const PROBE_AMOUNT = 1;

/** Queries Horizon for the best route for `sourceAmount`, plus a 1-unit probe for the spot rate. */
export async function fetchPathQuote(options: {
  horizonUrl: string;
  source: PathAsset;
  destination: PathAsset;
  sourceAmount: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<PathQuote | null> {
  const { horizonUrl, source, destination, sourceAmount, signal, fetchImpl = fetch } = options;
  if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) return null;

  const load = async (amount: number) => {
    const res = await fetchImpl(buildStrictSendUrl(horizonUrl, source, amount, destination), { signal });
    if (!res.ok) throw new Error(`Path lookup failed (${res.status})`);
    return pickBestRoute(parsePathRecords(await res.json()));
  };

  const probeAmount = Math.min(PROBE_AMOUNT, sourceAmount);
  const [best, probe] = await Promise.all([
    load(sourceAmount),
    probeAmount === sourceAmount ? Promise.resolve(null) : load(probeAmount).catch(() => null),
  ]);
  if (!best) return null;
  return buildQuote(best, probe ?? best);
}
