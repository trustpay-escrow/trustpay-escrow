import { describe, it, expect, vi } from 'vitest';
import {
  applySlippage,
  buildStrictSendUrl,
  computePriceImpactPct,
  fetchPathQuote,
  getPathAsset,
  parsePathRecords,
  pickBestRoute,
} from './path-payment';

const USDC = { code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' };

const records = (rows: Array<[string, string, string[]?]>) => ({
  _embedded: {
    records: rows.map(([s, d, hops]) => ({
      source_amount: s,
      destination_amount: d,
      path: (hops ?? []).map((code) => ({ asset_type: 'credit_alphanum4', asset_code: code, asset_issuer: 'GX' })),
    })),
  },
});

describe('path-payment', () => {
  it('maps tokens to classic assets', () => {
    expect(getPathAsset('XLM')).toEqual({ code: 'XLM' });
    expect(getPathAsset('USDC')?.issuer).toMatch(/^G/);
    expect(getPathAsset('NOPE')).toBeNull();
  });

  it('builds a strict-send URL for native and credit assets', () => {
    const native = buildStrictSendUrl('https://h.test/', { code: 'XLM' }, 10, USDC);
    expect(native).toContain('https://h.test/paths/strict-send?');
    expect(native).toContain('source_asset_type=native');
    expect(native).toContain('source_amount=10.0000000');
    expect(native).toContain(`destination_assets=USDC%3A${USDC.issuer}`);
    const credit = buildStrictSendUrl('https://h.test', USDC, 5, { code: 'XLM' });
    expect(credit).toContain('source_asset_code=USDC');
    expect(credit).toContain('destination_assets=native');
  });

  it('parses records and skips malformed ones', () => {
    const routes = parsePathRecords(records([['10', '1.2', ['EURC']], ['10', 'bad']]));
    expect(routes).toHaveLength(1);
    expect(routes[0].path[0].code).toBe('EURC');
    expect(parsePathRecords(null)).toEqual([]);
  });

  it('picks the highest output, preferring fewer hops on ties', () => {
    const best = pickBestRoute(parsePathRecords(records([['10', '1.0', ['A', 'B']], ['10', '1.5', ['A']], ['10', '1.5']])));
    expect(best?.destinationAmount).toBe(1.5);
    expect(best?.path).toHaveLength(0);
    expect(pickBestRoute([])).toBeNull();
  });

  it('applies slippage and measures price impact', () => {
    expect(applySlippage(100, 1)).toBe(99);
    expect(applySlippage(100, 2.5)).toBe(97.5);
    expect(computePriceImpactPct(0.2, 0.19)).toBeCloseTo(5);
    expect(computePriceImpactPct(0.2, 0.21)).toBe(0);
    expect(computePriceImpactPct(null, 0.2)).toBe(0);
  });

  it('quotes a swap with price impact derived from a 1-unit probe', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const amount = new URL(url).searchParams.get('source_amount');
      const body = amount === '1.0000000' ? records([['1', '0.2']]) : records([['100', '19']]);
      return { ok: true, status: 200, json: async () => body } as Response;
    });
    const quote = await fetchPathQuote({
      horizonUrl: 'https://h.test',
      source: { code: 'XLM' },
      destination: USDC,
      sourceAmount: 100,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(quote?.destinationAmount).toBe(19);
    expect(quote?.effectiveRate).toBeCloseTo(0.19);
    expect(quote?.priceImpactPct).toBeCloseTo(5);
  });

  it('returns null with no routes and throws on Horizon errors', async () => {
    const empty = vi.fn(async () => ({ ok: true, status: 200, json: async () => records([]) }) as Response);
    expect(
      await fetchPathQuote({ horizonUrl: 'h', source: { code: 'XLM' }, destination: USDC, sourceAmount: 5, fetchImpl: empty as unknown as typeof fetch })
    ).toBeNull();
    const failing = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response);
    await expect(
      fetchPathQuote({ horizonUrl: 'h', source: { code: 'XLM' }, destination: USDC, sourceAmount: 5, fetchImpl: failing as unknown as typeof fetch })
    ).rejects.toThrow('500');
    expect(await fetchPathQuote({ horizonUrl: 'h', source: { code: 'XLM' }, destination: USDC, sourceAmount: 0 })).toBeNull();
  });
});
