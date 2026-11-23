/**
 * SEP-0010 (Stellar Web Authentication) client.
 *
 * Flow: request a challenge transaction -> sign it with the wallet -> exchange the signed
 * envelope for a time-bound JWT. The JWT lives in the wallet store (memory only, never
 * persisted) while the backend also sets an httpOnly cookie, and is refreshed shortly
 * before it expires so an active session is never interrupted.
 */
import { signTransaction } from '@stellar/freighter-api';

export const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

/** Refresh this many ms before the token's `exp`. */
export const REFRESH_LEEWAY_MS = 60_000;
/** Never schedule a refresh sooner than this, to avoid hot loops on short-lived tokens. */
const MIN_REFRESH_DELAY_MS = 5_000;

export interface Sep10Challenge {
  transaction: string;
  network?: string;
  networkPassphrase?: string;
}

export interface Sep10VerifyResult {
  ok: boolean;
  status: number;
  token?: string;
  requiresRegistration?: boolean;
  error?: string;
}

export type ChallengeSigner = (challengeXdr: string, networkPassphrase: string) => Promise<string>;

export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

export function resolveNetworkPassphrase(challenge: Pick<Sep10Challenge, 'network' | 'networkPassphrase'>): string {
  if (challenge.networkPassphrase) return challenge.networkPassphrase;
  return challenge.network === 'PUBLIC' ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;
}

/** Normalises the different shapes wallets use to return a signed XDR. */
export function extractSignedXdr(result: unknown): string {
  if (typeof result === 'string' && result) return result;
  if (result && typeof result === 'object') {
    const r = result as { signedTxXdr?: string; signedTransaction?: string; error?: unknown };
    if (r.error) {
      const message = typeof r.error === 'string' ? r.error : (r.error as { message?: string }).message;
      throw new Error(message || 'Wallet rejected the challenge signature');
    }
    const xdr = r.signedTxXdr || r.signedTransaction;
    if (xdr) return xdr;
  }
  throw new Error('Wallet returned an empty challenge signature');
}

export async function requestChallenge(account: string, fetchImpl: typeof fetch = fetch): Promise<Sep10Challenge> {
  const res = await fetchImpl(`${getApiUrl()}/api/auth/challenge?account=${encodeURIComponent(account)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to retrieve authentication challenge');
  }
  const body = await res.json();
  if (!body?.transaction || typeof body.transaction !== 'string') {
    throw new Error('Authentication challenge response was malformed');
  }
  return body as Sep10Challenge;
}

export const signChallengeWithFreighter: ChallengeSigner = async (challengeXdr, networkPassphrase) => {
  const result = await signTransaction(challengeXdr, { networkPassphrase });
  return extractSignedXdr(result);
};

export async function verifyChallenge(signedXdr: string, fetchImpl: typeof fetch = fetch): Promise<Sep10VerifyResult> {
  const res = await fetchImpl(`${getApiUrl()}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ transaction: signedXdr }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    status: res.status,
    token: typeof data.token === 'string' ? data.token : undefined,
    requiresRegistration: res.status === 403 && Boolean(data.requiresRegistration),
    error: data.error,
  };
}

export interface Sep10AuthResult extends Sep10VerifyResult {
  signedXdr: string;
}

/** Runs the full challenge -> sign -> verify exchange. */
export async function authenticateWithSep10(options: {
  account: string;
  signer?: ChallengeSigner;
  fetchImpl?: typeof fetch;
}): Promise<Sep10AuthResult> {
  const { account, signer = signChallengeWithFreighter, fetchImpl = fetch } = options;
  const challenge = await requestChallenge(account, fetchImpl);
  const signedXdr = await signer(challenge.transaction, resolveNetworkPassphrase(challenge));
  const result = await verifyChallenge(signedXdr, fetchImpl);
  return { ...result, signedXdr };
}

/** Reads the `exp` claim (ms since epoch) from a JWT without verifying it. */
export function getTokenExpiryMs(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpiring(
  token: string | null | undefined,
  now = Date.now(),
  leewayMs = REFRESH_LEEWAY_MS
): boolean {
  const exp = getTokenExpiryMs(token);
  if (exp === null) return false;
  return exp - now <= leewayMs;
}

/** Milliseconds until the refresh should fire, or null if the token carries no expiry. */
export function getRefreshDelayMs(
  token: string | null | undefined,
  now = Date.now(),
  leewayMs = REFRESH_LEEWAY_MS
): number | null {
  const exp = getTokenExpiryMs(token);
  if (exp === null) return null;
  return Math.max(exp - now - leewayMs, MIN_REFRESH_DELAY_MS);
}

/**
 * Silently exchanges the current session (httpOnly cookie + Bearer token) for a fresh JWT.
 * Resolves with the new token, or null when the session can no longer be refreshed.
 */
export async function refreshSessionToken(
  currentToken: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
    const res = await fetchImpl(`${getApiUrl()}/api/auth/refresh`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return typeof data.token === 'string' ? data.token : null;
  } catch {
    return null;
  }
}

export interface SessionRefresherOptions {
  getToken: () => string | null;
  setToken: (token: string) => void;
  onExpired: () => void;
  fetchImpl?: typeof fetch;
}

/**
 * Keeps a session alive: schedules a refresh ahead of expiry and re-arms itself after every
 * success. Returns `{ reschedule, stop }`; call `reschedule()` whenever the token changes.
 */
export function createSessionRefresher({ getToken, setToken, onExpired, fetchImpl }: SessionRefresherOptions) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const reschedule = () => {
    clear();
    if (stopped) return;
    const delay = getRefreshDelayMs(getToken());
    if (delay === null) return;
    timer = setTimeout(async () => {
      const fresh = await refreshSessionToken(getToken(), fetchImpl);
      if (stopped) return;
      if (fresh) {
        setToken(fresh);
        reschedule();
      } else {
        onExpired();
      }
    }, delay);
  };

  return {
    reschedule,
    stop: () => {
      stopped = true;
      clear();
    },
  };
}
