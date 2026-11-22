'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLiquidityPoolConfig, getLiquidityPoolKey } from '@/config/tokens';
import { DEFAULT_POOL_FEE_BPS } from '@/lib/liquidity-depth';
import { fetchAmmPoolReserves, AmmPoolReserveSnapshot } from '@/lib/soroban';

export interface LiquidityPoolSnapshot {
  baseToken: string;
  quoteToken: string;
  reserveBase: number;
  reserveQuote: number;
  feeBps: number;
  source: 'live' | 'demo';
  fetchedAt: number;
}

export interface UseTokenRatesOptions {
  enabled?: boolean;
  sourceAccount?: string;
}

export interface UseTokenRatesResult {
  pool: LiquidityPoolSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function createDemoPoolSnapshot(
  baseToken: string,
  quoteToken: string,
  feeBps = DEFAULT_POOL_FEE_BPS
): LiquidityPoolSnapshot {
  const baseReserve = baseToken === 'XLM' ? 4_500_000 : 820_000;
  const quoteReserve = quoteToken === 'XLM' ? 4_500_000 : 640_000;
  return {
    baseToken,
    quoteToken,
    reserveBase: baseReserve,
    reserveQuote: quoteReserve,
    feeBps,
    source: 'demo',
    fetchedAt: Date.now(),
  };
}

export function useTokenRates(
  baseToken: string,
  quoteToken: string,
  options: UseTokenRatesOptions = {}
): UseTokenRatesResult {
  const { enabled = true, sourceAccount } = options;
  const [pool, setPool] = useState<LiquidityPoolSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || !baseToken || !quoteToken || baseToken === quoteToken) return;

    let active = true;
    const pairKey = getLiquidityPoolKey(baseToken, quoteToken);
    const config = getLiquidityPoolConfig(baseToken, quoteToken);
    const poolFeeBps = config?.feeBps ?? DEFAULT_POOL_FEE_BPS;
    const demoPool = createDemoPoolSnapshot(baseToken, quoteToken, poolFeeBps);

    type LoadResult = { kind: 'demo' } | { kind: 'live'; reserves: AmmPoolReserveSnapshot };
    const load: Promise<LoadResult | null> = Promise.resolve().then(
      (): Promise<LoadResult> | LoadResult | null => {
        if (!active) return null;
        if (!config || !config.contractAddress) return { kind: 'demo' };
        setPool(null);
        setLoading(true);
        setError(null);
        return fetchAmmPoolReserves({
          contractAddress: config.contractAddress,
          sourceAccount,
          reserveDecimals: config.reserveDecimals,
        }).then((reserves): LoadResult => ({ kind: 'live', reserves }));
      }
    );

    load
      .then((result) => {
        if (!active || !result) return;
        if (result.kind === 'demo') {
          setPool(demoPool);
          setLoading(false);
          setError(null);
          return;
        }
        setPool({
          baseToken,
          quoteToken,
          reserveBase: result.reserves.reserveBase,
          reserveQuote: result.reserves.reserveQuote,
          feeBps: poolFeeBps,
          source: 'live',
          fetchedAt: Date.now(),
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setPool(demoPool);
        setError(
          `Live reserves unavailable for ${pairKey} (${err instanceof Error ? err.message : String(err)}). Showing illustrative depth.`
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [baseToken, quoteToken, enabled, sourceAccount, reloadKey]);

  const pairActive = enabled && Boolean(baseToken) && Boolean(quoteToken) && baseToken !== quoteToken;
  return {
    pool: pairActive ? pool : null,
    loading: pairActive && loading,
    error: pairActive ? error : null,
    refresh,
  };
}

// ── USD price feed for price alerts (#253) ──────────────────────────────────

export const TOKEN_PRICE_POLL_MS = 60_000;

const COINGECKO_IDS: Record<string, string> = { XLM: 'stellar', USDC: 'usd-coin' };

export type TokenPricesUsd = Partial<Record<'XLM' | 'USDC', number>>;

/** Fetches USD prices. Override the source with NEXT_PUBLIC_PRICE_FEED_URL (same JSON shape as CoinGecko simple/price). */
export async function fetchTokenPricesUsd(tokens: Array<'XLM' | 'USDC'> = ['XLM', 'USDC']): Promise<TokenPricesUsd> {
  const ids = tokens.map((t) => COINGECKO_IDS[t]).join(',');
  const base = process.env.NEXT_PUBLIC_PRICE_FEED_URL || 'https://api.coingecko.com/api/v3/simple/price';
  const response = await fetch(`${base}?ids=${ids}&vs_currencies=usd`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Price feed responded with ${response.status}`);
  const data = (await response.json()) as Record<string, { usd?: number }>;
  const prices: TokenPricesUsd = {};
  for (const token of tokens) {
    const value = data[COINGECKO_IDS[token]]?.usd;
    if (typeof value === 'number' && Number.isFinite(value)) prices[token] = value;
  }
  return prices;
}

export interface UseTokenPricesResult {
  prices: TokenPricesUsd;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

/** Polls USD prices every 60 seconds while mounted. */
export function useTokenPrices(
  options: { enabled?: boolean; pollMs?: number } = {}
): UseTokenPricesResult {
  const { enabled = true, pollMs = TOKEN_PRICE_POLL_MS } = options;
  const [prices, setPrices] = useState<TokenPricesUsd>({});
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      try {
        const next = await fetchTokenPricesUsd();
        if (!active) return;
        setPrices((prev) => ({ ...prev, ...next }));
        setLastUpdated(Date.now());
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Price feed unavailable');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), pollMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, pollMs]);

  return { prices, loading, error, lastUpdated };
}
