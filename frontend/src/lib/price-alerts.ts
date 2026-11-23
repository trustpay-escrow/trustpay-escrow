/**
 * Token price alerts (#253): threshold evaluation and localStorage persistence.
 */

export type AlertToken = 'XLM' | 'USDC';
export type AlertDirection = 'above' | 'below';

export interface PriceAlert {
  id: string;
  token: AlertToken;
  direction: AlertDirection;
  /** Target price in USD. */
  target: number;
  createdAt: number;
  /** Set once the threshold was crossed and the user was notified. */
  triggeredAt?: number;
  /** Price at the moment the alert fired. */
  triggeredPrice?: number;
}

export type PriceMap = Partial<Record<AlertToken, number>>;

export const PRICE_ALERTS_STORAGE_KEY = 'trustpay.priceAlerts.v1';

export function describeAlert(alert: Pick<PriceAlert, 'token' | 'direction' | 'target'>): string {
  return `${alert.token} ${alert.direction === 'above' ? '>' : '<'} $${formatPrice(alert.target)}`;
}

export function formatPrice(value: number): string {
  return value >= 1 ? value.toFixed(2) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0');
}

/** True when `price` satisfies the alert's threshold. Equality counts as a breach. */
export function isThresholdBreached(
  alert: Pick<PriceAlert, 'direction' | 'target'>,
  price: number | undefined
): boolean {
  if (price === undefined || !Number.isFinite(price)) return false;
  return alert.direction === 'above' ? price >= alert.target : price <= alert.target;
}

/**
 * Alerts that fire for the given prices. Already-triggered alerts are skipped,
 * so each alert notifies once.
 */
export function evaluateAlerts(alerts: PriceAlert[], prices: PriceMap): PriceAlert[] {
  return alerts.filter((a) => a.triggeredAt === undefined && isThresholdBreached(a, prices[a.token]));
}

/** Returns a new list with the fired alerts stamped as triggered. */
export function markTriggered(
  alerts: PriceAlert[],
  fired: PriceAlert[],
  prices: PriceMap,
  now = Date.now()
): PriceAlert[] {
  const ids = new Set(fired.map((a) => a.id));
  return alerts.map((a) =>
    ids.has(a.id) ? { ...a, triggeredAt: now, triggeredPrice: prices[a.token] } : a
  );
}

export type NewAlertResult =
  | { ok: true; alert: PriceAlert }
  | { ok: false; error: string };

export function createAlert(
  input: { token: AlertToken; direction: AlertDirection; target: string | number },
  now = Date.now()
): NewAlertResult {
  const target = typeof input.target === 'number' ? input.target : Number(input.target);
  if (!Number.isFinite(target) || target <= 0) {
    return { ok: false, error: 'Enter a target price greater than 0.' };
  }
  return {
    ok: true,
    alert: {
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      token: input.token,
      direction: input.direction,
      target,
      createdAt: now,
    },
  };
}

function isAlert(value: unknown): value is PriceAlert {
  const v = value as PriceAlert;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.id === 'string' &&
    (v.token === 'XLM' || v.token === 'USDC') &&
    (v.direction === 'above' || v.direction === 'below') &&
    typeof v.target === 'number' &&
    Number.isFinite(v.target)
  );
}

export function loadAlerts(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): PriceAlert[] {
  try {
    const raw = storage?.getItem(PRICE_ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAlert) : [];
  } catch {
    return [];
  }
}

export function saveAlerts(
  alerts: PriceAlert[],
  storage: Pick<Storage, 'setItem'> | undefined = safeStorage()
): void {
  try {
    storage?.setItem(PRICE_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    /* storage unavailable or full: alerts still work for this session */
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
