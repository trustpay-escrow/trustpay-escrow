/**
 * Client helpers for fiat on-ramps: SEP-0024 interactive deposits (MoneyGram Access and any
 * compliant anchor) and the MoonPay buy widget, plus Horizon-based USDC deposit detection.
 */
import { SUPPORTED_TOKENS } from '@/config/tokens';
import { MAINNET_PASSPHRASE, TESTNET_PASSPHRASE, extractSignedXdr, type ChallengeSigner } from '@/lib/sep10-auth';

export const MONEYGRAM_ANCHOR_DOMAIN =
  process.env.NEXT_PUBLIC_MONEYGRAM_ANCHOR_DOMAIN || 'extstellar.moneygram.com';
export const MOONPAY_API_KEY = process.env.NEXT_PUBLIC_MOONPAY_API_KEY || '';
export const MOONPAY_BASE_URL =
  process.env.NEXT_PUBLIC_MOONPAY_BASE_URL || 'https://buy-sandbox.moonpay.com';

/** Published MoonPay-style card pricing used for the pre-purchase estimate (percent + fixed USD). */
export const MOONPAY_FEE = { percent: 4.5, fixed: 3.99, minimum: 3.99 };

export type OnRampProvider = 'moonpay' | 'moneygram';

export interface AnchorEndpoints {
  transferServer: string;
  webAuthEndpoint: string;
}

export interface FeeSchedule {
  percent: number;
  fixed: number;
  minimum?: number;
}

export interface FeeBreakdown {
  amount: number;
  fee: number;
  net: number;
  percentFee: number;
  fixedFee: number;
}

export interface AnchorDepositInfo {
  enabled: boolean;
  fee: FeeSchedule;
  minAmount?: number;
  maxAmount?: number;
}

export interface InteractiveDeposit {
  id: string;
  url: string;
}

export interface AnchorTransaction {
  id: string;
  status: string;
  amountIn?: string;
  amountOut?: string;
  amountFee?: string;
  message?: string;
}

const TERMINAL_OK = new Set(['completed']);
const TERMINAL_FAIL = new Set(['error', 'expired', 'incomplete', 'no_market', 'too_small', 'too_large', 'refunded']);

export const isAnchorTxComplete = (status: string) => TERMINAL_OK.has(status);
export const isAnchorTxFailed = (status: string) => TERMINAL_FAIL.has(status);

/** Fee = max(minimum, amount × percent + fixed). */
export function computeFeeBreakdown(amount: number, schedule: FeeSchedule): FeeBreakdown {
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  if (safe === 0) return { amount: 0, fee: 0, net: 0, percentFee: 0, fixedFee: 0 };
  const percentFee = (safe * schedule.percent) / 100;
  const raw = percentFee + schedule.fixed;
  const fee = Math.min(safe, Math.max(raw, schedule.minimum ?? 0));
  return {
    amount: safe,
    fee: round2(fee),
    net: round2(safe - fee),
    percentFee: round2(percentFee),
    fixedFee: round2(schedule.fixed),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseStellarToml(toml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of toml.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"([^"]*)"/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

export async function resolveAnchor(domain: string, fetchImpl: typeof fetch = fetch): Promise<AnchorEndpoints> {
  const res = await fetchImpl(`https://${domain}/.well-known/stellar.toml`);
  if (!res.ok) throw new Error(`Could not load stellar.toml for ${domain}`);
  const toml = parseStellarToml(await res.text());
  const transferServer = toml.TRANSFER_SERVER_SEP0024;
  const webAuthEndpoint = toml.WEB_AUTH_ENDPOINT;
  if (!transferServer || !webAuthEndpoint) {
    throw new Error(`${domain} does not support SEP-0024 interactive deposits`);
  }
  return { transferServer: transferServer.replace(/\/$/, ''), webAuthEndpoint };
}

/** SEP-0010 login against the anchor (not TrustPay's backend) to obtain the anchor's JWT. */
export async function authenticateWithAnchor(options: {
  webAuthEndpoint: string;
  account: string;
  signer: ChallengeSigner;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const { webAuthEndpoint, account, signer, fetchImpl = fetch } = options;
  const challengeRes = await fetchImpl(`${webAuthEndpoint}?account=${encodeURIComponent(account)}`);
  if (!challengeRes.ok) throw new Error('Anchor rejected the authentication request');
  const challenge = await challengeRes.json();
  const passphrase: string =
    challenge.network_passphrase ||
    (process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? TESTNET_PASSPHRASE);
  const signed = extractSignedXdr(await signer(challenge.transaction, passphrase));
  const tokenRes = await fetchImpl(webAuthEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signed }),
  });
  const body = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !body.token) throw new Error(body.error || 'Anchor authentication failed');
  return body.token as string;
}

export async function fetchDepositInfo(
  transferServer: string,
  assetCode = 'USDC',
  fetchImpl: typeof fetch = fetch
): Promise<AnchorDepositInfo> {
  const res = await fetchImpl(`${transferServer}/info`);
  if (!res.ok) throw new Error('Could not load anchor fee information');
  const info = await res.json();
  const asset = info?.deposit?.[assetCode];
  if (!asset?.enabled) return { enabled: false, fee: { percent: 0, fixed: 0 } };
  return {
    enabled: true,
    fee: {
      percent: Number(asset.fee_percent ?? 0),
      fixed: Number(asset.fee_fixed ?? 0),
      minimum: asset.fee_minimum !== undefined ? Number(asset.fee_minimum) : undefined,
    },
    minAmount: asset.min_amount !== undefined ? Number(asset.min_amount) : undefined,
    maxAmount: asset.max_amount !== undefined ? Number(asset.max_amount) : undefined,
  };
}

export async function startInteractiveDeposit(options: {
  transferServer: string;
  token: string;
  account: string;
  assetCode?: string;
  amount?: number;
  fetchImpl?: typeof fetch;
}): Promise<InteractiveDeposit> {
  const { transferServer, token, account, assetCode = 'USDC', amount, fetchImpl = fetch } = options;
  const form = new URLSearchParams({ asset_code: assetCode, account });
  if (amount && amount > 0) form.set('amount', String(amount));
  const res = await fetchImpl(`${transferServer}/transactions/deposit/interactive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url || !body.id) throw new Error(body.error || 'Anchor could not start the deposit');
  return { id: String(body.id), url: appendPostMessageCallback(String(body.url)) };
}

/** SEP-0024 asks wallets to request `callback=postMessage` so the popup can report status. */
export function appendPostMessageCallback(url: string): string {
  const u = new URL(url);
  u.searchParams.set('callback', 'postMessage');
  return u.toString();
}

export async function fetchAnchorTransaction(
  transferServer: string,
  token: string,
  id: string,
  fetchImpl: typeof fetch = fetch
): Promise<AnchorTransaction> {
  const res = await fetchImpl(`${transferServer}/transaction?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Could not load anchor transaction status');
  const { transaction: t } = await res.json();
  return {
    id: t.id,
    status: t.status,
    amountIn: t.amount_in,
    amountOut: t.amount_out,
    amountFee: t.amount_fee,
    message: t.message,
  };
}

export function buildMoonPayUrl(options: {
  walletAddress: string;
  amountUsd?: number;
  apiKey?: string;
  baseUrl?: string;
  redirectUrl?: string;
}): string {
  const { walletAddress, amountUsd, apiKey = MOONPAY_API_KEY, baseUrl = MOONPAY_BASE_URL, redirectUrl } = options;
  const u = new URL(baseUrl);
  u.searchParams.set('apiKey', apiKey);
  u.searchParams.set('currencyCode', 'usdc_xlm');
  u.searchParams.set('walletAddress', walletAddress);
  u.searchParams.set('lockAmount', 'false');
  if (amountUsd && amountUsd > 0) u.searchParams.set('baseCurrencyAmount', String(amountUsd));
  if (redirectUrl) u.searchParams.set('redirectURL', redirectUrl);
  return u.toString();
}

interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

export function readUsdcBalance(balances: HorizonBalance[] | undefined): number {
  const usdc = SUPPORTED_TOKENS.USDC;
  const line = (balances ?? []).find(
    (b) => b.asset_code === 'USDC' && (!usdc.classicIssuer || b.asset_issuer === usdc.classicIssuer)
  );
  const value = line ? Number(line.balance) : 0;
  return Number.isFinite(value) ? value : 0;
}

export async function fetchUsdcBalance(
  horizonUrl: string,
  account: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<number> {
  const res = await fetchImpl(`${horizonUrl.replace(/\/$/, '')}/accounts/${encodeURIComponent(account)}`, { signal });
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`Balance lookup failed (${res.status})`);
  return readUsdcBalance((await res.json()).balances);
}

/**
 * Polls the Stellar ledger until the account's USDC balance rises above `baseline`.
 * Resolves with the deposited amount; rejects on timeout or abort.
 */
export async function waitForUsdcDeposit(options: {
  horizonUrl: string;
  account: string;
  baseline: number;
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<number> {
  const { horizonUrl, account, baseline, intervalMs = 5000, timeoutMs = 15 * 60_000, signal, fetchImpl = fetch } = options;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Deposit detection cancelled');
    try {
      const balance = await fetchUsdcBalance(horizonUrl, account, fetchImpl, signal);
      if (balance - baseline > 1e-7) return Math.round((balance - baseline) * 1e7) / 1e7;
    } catch {
      if (signal?.aborted) throw new Error('Deposit detection cancelled');
      // transient Horizon errors: keep polling until the deadline
    }
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, intervalMs);
      signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
  throw new Error('Timed out waiting for the USDC deposit to arrive on Stellar');
}

export const NETWORK_PASSPHRASES = { PUBLIC: MAINNET_PASSPHRASE, TESTNET: TESTNET_PASSPHRASE };
