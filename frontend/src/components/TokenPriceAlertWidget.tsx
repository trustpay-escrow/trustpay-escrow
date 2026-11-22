'use client';

import React, { useEffect, useState } from 'react';
import { useTokenPrices } from '@/hooks/useTokenRates';
import {
  createAlert,
  describeAlert,
  evaluateAlerts,
  formatPrice,
  loadAlerts,
  markTriggered,
  saveAlerts,
  type AlertDirection,
  type AlertToken,
  type PriceAlert,
} from '@/lib/price-alerts';

export interface TokenPriceAlertWidgetProps {
  /** "Fund Escrow Now" shortcut: opens the funding flow at the price that fired. */
  onFundNow?: (alert: PriceAlert, price: number | undefined) => void;
  className?: string;
}

function notify(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    /* notifications unsupported in this context */
  }
}

/**
 * Price alerts for XLM / USDC (#253). Checks the feed every 60 s, raises a
 * browser notification when a threshold is crossed, and keeps alerts in
 * localStorage.
 */
export function TokenPriceAlertWidget({ onFundNow, className = '' }: TokenPriceAlertWidgetProps) {
  const { prices, error } = useTokenPrices();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<AlertToken>('XLM');
  const [direction, setDirection] = useState<AlertDirection>('above');
  const [target, setTarget] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [permission, setPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  useEffect(() => {
    setAlerts(loadAlerts());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveAlerts(alerts);
  }, [alerts, hydrated]);

  // Evaluate when fresh prices arrive or the alert list changes. Triggered
  // alerts are skipped, so this settles after one pass.
  useEffect(() => {
    if (!hydrated) return;
    const fired = evaluateAlerts(alerts, prices);
    if (fired.length === 0) return;
    setAlerts((prev) => markTriggered(prev, fired, prices));
    for (const alert of fired) {
      notify('Price alert', `${describeAlert(alert)} — now $${formatPrice(prices[alert.token] ?? alert.target)}`);
    }
  }, [prices, alerts, hydrated]);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const result = createAlert({ token, direction, target });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setAlerts((prev) => [...prev, result.alert]);
    setTarget('');
    setFormError(null);
  };

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  };

  return (
    <section
      className={`bg-[#18181b] border border-[#27272a] rounded-2xl p-5 space-y-4 ${className}`}
      aria-labelledby="price-alert-heading"
      data-testid="price-alert-widget"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="price-alert-heading" className="text-sm font-bold text-white">
            Price alerts
          </h3>
          <p className="text-[11px] text-[#71717a]" data-testid="price-alert-current">
            XLM {prices.XLM !== undefined ? `$${formatPrice(prices.XLM)}` : '—'} · USDC{' '}
            {prices.USDC !== undefined ? `$${formatPrice(prices.USDC)}` : '—'} · checked every 60s
          </p>
        </div>
        {permission !== 'granted' && permission !== 'unsupported' && (
          <button
            type="button"
            onClick={requestPermission}
            className="text-[11px] text-indigo-400 hover:text-indigo-300"
            data-testid="price-alert-enable-notifications"
          >
            Enable notifications
          </button>
        )}
      </div>

      {error && alerts.length > 0 && (
        <p className="text-[11px] text-amber-300" role="status">
          Price feed unavailable. Alerts will resume when it recovers.
        </p>
      )}

      <form onSubmit={add} className="flex flex-wrap items-end gap-2" aria-label="Add price alert">
        <label className="text-[11px] text-[#a1a1aa]">
          Token
          <select
            value={token}
            onChange={(e) => setToken(e.target.value as AlertToken)}
            className="block mt-1 px-2 py-1.5 bg-[#232326] border border-[#333338] rounded-lg text-white text-xs"
            data-testid="price-alert-token"
          >
            <option value="XLM">XLM</option>
            <option value="USDC">USDC</option>
          </select>
        </label>
        <label className="text-[11px] text-[#a1a1aa]">
          Alert when
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as AlertDirection)}
            className="block mt-1 px-2 py-1.5 bg-[#232326] border border-[#333338] rounded-lg text-white text-xs"
            data-testid="price-alert-direction"
          >
            <option value="above">goes above</option>
            <option value="below">drops below</option>
          </select>
        </label>
        <label className="text-[11px] text-[#a1a1aa]">
          Price (USD)
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0.15"
            className="block mt-1 w-24 px-2 py-1.5 bg-[#232326] border border-[#333338] rounded-lg text-white text-xs"
            data-testid="price-alert-target"
          />
        </label>
        <button
          type="submit"
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg"
          data-testid="price-alert-add"
        >
          Add alert
        </button>
      </form>
      {formError && (
        <p className="text-[11px] text-red-400" role="alert">
          {formError}
        </p>
      )}

      {alerts.length === 0 ? (
        <p className="text-xs text-[#71717a]" data-testid="price-alert-empty">
          No alerts yet.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="price-alert-list">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="flex items-center justify-between gap-2 bg-[#1c1c20] border border-[#27272a] rounded-xl p-2.5 text-xs"
              data-testid={`price-alert-${alert.id}`}
            >
              <div>
                <span className="text-white font-semibold">{describeAlert(alert)}</span>
                {alert.triggeredAt !== undefined && (
                  <span className="ml-2 text-emerald-400" data-testid={`price-alert-triggered-${alert.id}`}>
                    Triggered at ${formatPrice(alert.triggeredPrice ?? alert.target)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {alert.triggeredAt !== undefined && onFundNow && (
                  <button
                    type="button"
                    onClick={() => onFundNow(alert, alert.triggeredPrice)}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-bold"
                    data-testid={`price-alert-fund-${alert.id}`}
                  >
                    Fund Escrow Now
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                  aria-label={`Delete alert ${describeAlert(alert)}`}
                  className="text-[#71717a] hover:text-red-400"
                  data-testid={`price-alert-delete-${alert.id}`}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
