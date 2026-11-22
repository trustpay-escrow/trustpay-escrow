import { describe, it, expect, vi } from 'vitest';
import {
  appendPostMessageCallback,
  buildMoonPayUrl,
  computeFeeBreakdown,
  fetchDepositInfo,
  isAnchorTxComplete,
  isAnchorTxFailed,
  parseStellarToml,
  readUsdcBalance,
  resolveAnchor,
  startInteractiveDeposit,
  waitForUsdcDeposit,
} from './anchor-client';
import { SUPPORTED_TOKENS } from '@/config/tokens';

const json = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body, text: async () => String(body) }) as Response;

describe('anchor-client', () => {
  it('computes fee breakdowns with percent, fixed and minimum', () => {
    expect(computeFeeBreakdown(100, { percent: 1, fixed: 2 })).toMatchObject({ fee: 3, net: 97 });
    expect(computeFeeBreakdown(10, { percent: 1, fixed: 0, minimum: 2 })).toMatchObject({ fee: 2, net: 8 });
    expect(computeFeeBreakdown(1, { percent: 0, fixed: 5 }).fee).toBe(1);
    expect(computeFeeBreakdown(0, { percent: 5, fixed: 5 })).toMatchObject({ fee: 0, net: 0 });
  });

  it('parses stellar.toml and resolves SEP-24 endpoints', async () => {
    const toml = 'WEB_AUTH_ENDPOINT="https://a.test/auth"\nTRANSFER_SERVER_SEP0024="https://a.test/sep24/"\n';
    expect(parseStellarToml(toml).WEB_AUTH_ENDPOINT).toBe('https://a.test/auth');
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: async () => toml });
    expect(await resolveAnchor('a.test', fetchImpl)).toEqual({
      transferServer: 'https://a.test/sep24',
      webAuthEndpoint: 'https://a.test/auth',
    });
    const missing = vi.fn().mockResolvedValue({ ok: true, text: async () => 'FOO="bar"' });
    await expect(resolveAnchor('b.test', missing)).rejects.toThrow('SEP-0024');
  });

  it('reads USDC deposit fee info', async () => {
    const info = { deposit: { USDC: { enabled: true, fee_fixed: 1.5, fee_percent: 0.5, min_amount: 5 } } };
    const result = await fetchDepositInfo('https://a.test', 'USDC', vi.fn().mockResolvedValue(json(info)));
    expect(result).toMatchObject({ enabled: true, fee: { fixed: 1.5, percent: 0.5 }, minAmount: 5 });
    expect((await fetchDepositInfo('https://a.test', 'USDC', vi.fn().mockResolvedValue(json({ deposit: {} })))).enabled).toBe(false);
  });

  it('starts an interactive deposit and requests the postMessage callback', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ id: 'tx1', url: 'https://a.test/kyc?x=1' }));
    const dep = await startInteractiveDeposit({ transferServer: 'https://a.test', token: 'jwt', account: 'GA', amount: 50, fetchImpl });
    expect(dep.id).toBe('tx1');
    expect(new URL(dep.url).searchParams.get('callback')).toBe('postMessage');
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer jwt');
    expect(init.body).toContain('asset_code=USDC');
    expect(init.body).toContain('amount=50');
    expect(appendPostMessageCallback('https://x.test/?a=1')).toContain('callback=postMessage');
  });

  it('classifies anchor statuses', () => {
    expect(isAnchorTxComplete('completed')).toBe(true);
    expect(isAnchorTxFailed('expired')).toBe(true);
    expect(isAnchorTxFailed('pending_user_transfer_start')).toBe(false);
  });

  it('builds a MoonPay URL for USDC on Stellar', () => {
    const u = new URL(buildMoonPayUrl({ walletAddress: 'GA', amountUsd: 100, apiKey: 'pk', baseUrl: 'https://m.test' }));
    expect(u.searchParams.get('currencyCode')).toBe('usdc_xlm');
    expect(u.searchParams.get('walletAddress')).toBe('GA');
    expect(u.searchParams.get('baseCurrencyAmount')).toBe('100');
  });

  it('reads the USDC balance for the configured issuer only', () => {
    const issuer = SUPPORTED_TOKENS.USDC.classicIssuer;
    expect(
      readUsdcBalance([
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GFAKE', balance: '999' },
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: issuer, balance: '12.5' },
      ])
    ).toBe(12.5);
    expect(readUsdcBalance(undefined)).toBe(0);
  });

  it('detects a USDC deposit by polling Horizon', async () => {
    const issuer = SUPPORTED_TOKENS.USDC.classicIssuer;
    const balances = ['0', '0', '25'];
    const fetchImpl = vi.fn(async () =>
      json({ balances: [{ asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: issuer, balance: balances.shift() ?? '25' }] })
    );
    const received = await waitForUsdcDeposit({
      horizonUrl: 'https://h.test',
      account: 'GA',
      baseline: 0,
      intervalMs: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(received).toBe(25);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('times out when no deposit arrives', async () => {
    const fetchImpl = vi.fn(async () => json({ balances: [] }));
    await expect(
      waitForUsdcDeposit({ horizonUrl: 'h', account: 'GA', baseline: 0, intervalMs: 1, timeoutMs: 10, fetchImpl: fetchImpl as unknown as typeof fetch })
    ).rejects.toThrow('Timed out');
  });
});
