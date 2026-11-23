import { describe, expect, it } from 'vitest';
import {
  PRICE_ALERTS_STORAGE_KEY,
  createAlert,
  describeAlert,
  evaluateAlerts,
  isThresholdBreached,
  loadAlerts,
  markTriggered,
  saveAlerts,
  type PriceAlert,
} from './price-alerts';

const alert = (over: Partial<PriceAlert> = {}): PriceAlert => ({
  id: 'a1',
  token: 'XLM',
  direction: 'above',
  target: 0.15,
  createdAt: 0,
  ...over,
});

describe('threshold evaluation (#253)', () => {
  it('fires "above" alerts at or over the target', () => {
    expect(isThresholdBreached(alert(), 0.16)).toBe(true);
    expect(isThresholdBreached(alert(), 0.15)).toBe(true);
    expect(isThresholdBreached(alert(), 0.14)).toBe(false);
  });

  it('fires "below" alerts at or under the target', () => {
    const below = alert({ direction: 'below' });
    expect(isThresholdBreached(below, 0.1)).toBe(true);
    expect(isThresholdBreached(below, 0.15)).toBe(true);
    expect(isThresholdBreached(below, 0.2)).toBe(false);
  });

  it('never fires without a usable price', () => {
    expect(isThresholdBreached(alert(), undefined)).toBe(false);
    expect(isThresholdBreached(alert(), Number.NaN)).toBe(false);
  });

  it('evaluates each alert against its own token and skips ones already triggered', () => {
    const list = [
      alert({ id: 'x' }),
      alert({ id: 'u', token: 'USDC', target: 1.01 }),
      alert({ id: 'done', triggeredAt: 5 }),
    ];
    const fired = evaluateAlerts(list, { XLM: 0.2, USDC: 1.0 });
    expect(fired.map((a) => a.id)).toEqual(['x']);
  });

  it('marks fired alerts so they notify only once', () => {
    const list = [alert({ id: 'x' }), alert({ id: 'y', target: 9 })];
    const prices = { XLM: 0.2 };
    const updated = markTriggered(list, evaluateAlerts(list, prices), prices, 123);
    expect(updated[0]).toMatchObject({ triggeredAt: 123, triggeredPrice: 0.2 });
    expect(updated[1].triggeredAt).toBeUndefined();
    expect(evaluateAlerts(updated, prices)).toEqual([]);
  });

  it('describes an alert the way the user typed it', () => {
    expect(describeAlert(alert())).toBe('XLM > $0.15');
    expect(describeAlert(alert({ direction: 'below', token: 'USDC', target: 1 }))).toBe('USDC < $1.00');
  });
});

describe('creating alerts', () => {
  it('rejects empty, zero, negative and non-numeric targets', () => {
    for (const bad of ['', '0', '-1', 'abc']) {
      expect(createAlert({ token: 'XLM', direction: 'above', target: bad }).ok).toBe(false);
    }
  });

  it('creates an alert from a valid target', () => {
    const result = createAlert({ token: 'XLM', direction: 'above', target: '0.15' });
    expect(result.ok && result.alert).toMatchObject({ token: 'XLM', direction: 'above', target: 0.15 });
  });
});

describe('persistence', () => {
  it('round-trips alerts through storage and ignores corrupt data', () => {
    const store: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    };
    saveAlerts([alert()], storage);
    expect(loadAlerts(storage)).toEqual([alert()]);

    store[PRICE_ALERTS_STORAGE_KEY] = '{not json';
    expect(loadAlerts(storage)).toEqual([]);
    store[PRICE_ALERTS_STORAGE_KEY] = JSON.stringify([{ id: 1 }, alert()]);
    expect(loadAlerts(storage)).toEqual([alert()]);
  });
});
