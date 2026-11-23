import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  authenticateWithSep10,
  createSessionRefresher,
  extractSignedXdr,
  getRefreshDelayMs,
  getTokenExpiryMs,
  isTokenExpiring,
  MAINNET_PASSPHRASE,
  refreshSessionToken,
  REFRESH_LEEWAY_MS,
  resolveNetworkPassphrase,
  TESTNET_PASSPHRASE,
} from './sep10-auth';

vi.mock('@stellar/freighter-api', () => ({ signTransaction: vi.fn() }));

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const makeJwt = (expSeconds: number) => `${b64url({ alg: 'HS256' })}.${b64url({ exp: expSeconds })}.sig`;

const res = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

describe('sep10-auth', () => {
  it('reads the JWT expiry and flags tokens close to expiring', () => {
    const now = 1_700_000_000_000;
    const jwt = makeJwt(now / 1000 + 600);
    expect(getTokenExpiryMs(jwt)).toBe(now + 600_000);
    expect(isTokenExpiring(jwt, now)).toBe(false);
    expect(isTokenExpiring(jwt, now + 600_000 - REFRESH_LEEWAY_MS + 1)).toBe(true);
    expect(getTokenExpiryMs('garbage')).toBeNull();
    expect(getTokenExpiryMs(null)).toBeNull();
    expect(isTokenExpiring('opaque-token')).toBe(false);
  });

  it('schedules the refresh ahead of expiry with a floor', () => {
    const now = 1_700_000_000_000;
    expect(getRefreshDelayMs(makeJwt(now / 1000 + 600), now)).toBe(600_000 - REFRESH_LEEWAY_MS);
    expect(getRefreshDelayMs(makeJwt(now / 1000 + 10), now)).toBe(5_000);
    expect(getRefreshDelayMs('opaque', now)).toBeNull();
  });

  it('resolves the network passphrase', () => {
    expect(resolveNetworkPassphrase({ network: 'PUBLIC' })).toBe(MAINNET_PASSPHRASE);
    expect(resolveNetworkPassphrase({ network: 'TESTNET' })).toBe(TESTNET_PASSPHRASE);
    expect(resolveNetworkPassphrase({ networkPassphrase: 'custom' })).toBe('custom');
  });

  it('extracts signed XDR from different wallet response shapes', () => {
    expect(extractSignedXdr('XDR')).toBe('XDR');
    expect(extractSignedXdr({ signedTxXdr: 'A' })).toBe('A');
    expect(() => extractSignedXdr({ error: 'User declined' })).toThrow('User declined');
    expect(() => extractSignedXdr({})).toThrow('empty');
  });

  it('runs challenge -> sign -> verify and returns the JWT', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res({ transaction: 'CHALLENGE', network: 'TESTNET' }))
      .mockResolvedValueOnce(res({ token: 'jwt' }));
    const signer = vi.fn().mockResolvedValue('SIGNED');
    const result = await authenticateWithSep10({ account: 'GABC', signer, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(signer).toHaveBeenCalledWith('CHALLENGE', TESTNET_PASSPHRASE);
    expect(result).toMatchObject({ ok: true, token: 'jwt', signedXdr: 'SIGNED' });
    const [, verifyInit] = fetchImpl.mock.calls[1];
    expect(JSON.parse(verifyInit.body)).toEqual({ transaction: 'SIGNED' });
    expect(verifyInit.credentials).toBe('include');
  });

  it('reports registration-required and backend errors without throwing', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res({ transaction: 'C' }))
      .mockResolvedValueOnce(res({ requiresRegistration: true }, false, 403));
    const result = await authenticateWithSep10({ account: 'G', signer: async () => 'S', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.requiresRegistration).toBe(true);
    expect(result.ok).toBe(false);

    const failing = vi.fn().mockResolvedValueOnce(res({ error: 'nope' }, false, 500));
    await expect(
      authenticateWithSep10({ account: 'G', signer: async () => 'S', fetchImpl: failing as unknown as typeof fetch })
    ).rejects.toThrow('nope');
  });

  it('refreshes a session token via cookie + bearer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res({ token: 'fresh' }));
    expect(await refreshSessionToken('old', fetchImpl as unknown as typeof fetch)).toBe('fresh');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/api/auth/refresh');
    expect(init.headers.Authorization).toBe('Bearer old');
    expect(init.credentials).toBe('include');
    expect(await refreshSessionToken('old', vi.fn().mockResolvedValue(res({}, false, 401)) as unknown as typeof fetch)).toBeNull();
    expect(await refreshSessionToken('old', vi.fn().mockRejectedValue(new Error('net')) as unknown as typeof fetch)).toBeNull();
  });

  describe('createSessionRefresher', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('refreshes before expiry, stores the new token and re-arms', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      let token = makeJwt(nowSec + 120);
      const next = makeJwt(nowSec + 3600);
      const fetchImpl = vi.fn().mockResolvedValue(res({ token: next }));
      const setToken = vi.fn((t: string) => (token = t));
      const onExpired = vi.fn();
      const refresher = createSessionRefresher({ getToken: () => token, setToken, onExpired, fetchImpl: fetchImpl as unknown as typeof fetch });
      refresher.reschedule();

      await vi.advanceTimersByTimeAsync(120_000 - REFRESH_LEEWAY_MS + 100);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(setToken).toHaveBeenCalledWith(next);
      expect(onExpired).not.toHaveBeenCalled();

      // re-armed for the new token
      // the refreshed token expires at +3600s, so the next refresh fires at +3540s overall
      await vi.advanceTimersByTimeAsync(3540_000 - (120_000 - REFRESH_LEEWAY_MS + 100) + 100);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      refresher.stop();
    });

    it('calls onExpired when the refresh fails and stops cleanly', async () => {
      const token = makeJwt(Math.floor(Date.now() / 1000) + 90);
      const onExpired = vi.fn();
      const refresher = createSessionRefresher({
        getToken: () => token,
        setToken: vi.fn(),
        onExpired,
        fetchImpl: vi.fn().mockResolvedValue(res({}, false, 401)) as unknown as typeof fetch,
      });
      refresher.reschedule();
      await vi.advanceTimersByTimeAsync(90_000);
      expect(onExpired).toHaveBeenCalledTimes(1);

      const stopped = createSessionRefresher({ getToken: () => token, setToken: vi.fn(), onExpired, fetchImpl: vi.fn() as unknown as typeof fetch });
      stopped.reschedule();
      stopped.stop();
      await vi.advanceTimersByTimeAsync(200_000);
      expect(onExpired).toHaveBeenCalledTimes(1);
    });
  });
});
