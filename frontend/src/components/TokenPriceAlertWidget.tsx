'use client';

import React, { useState, useEffect, useId } from 'react';
import Link from 'next/link';
import { useTokenRates } from '../hooks/useTokenRates';

export interface PriceAlert {
  id: string;
  token: 'XLM' | 'USDC' | 'EURC';
  condition: 'ABOVE' | 'BELOW';
  threshold: number;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
}

export const STORAGE_KEY = 'trustpay_price_alerts';

export function evaluatePriceAlert(alert: PriceAlert, currentPrice: number): boolean {
  if (!alert.isActive) return false;
  if (alert.condition === 'ABOVE') {
    return currentPrice >= alert.threshold;
  }
  if (alert.condition === 'BELOW') {
    return currentPrice <= alert.threshold;
  }
  return false;
}

export function TokenPriceAlertWidget() {
  const tokenSelectId = useId();
  const conditionSelectId = useId();
  const thresholdInputId = useId();
  const { rates, lastUpdated, loading } = useTokenRates(60000);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [selectedToken, setSelectedToken] = useState<'XLM' | 'USDC' | 'EURC'>('XLM');
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [thresholdInput, setThresholdInput] = useState<string>('');
  const [notificationStatus, setNotificationStatus] = useState<string>('');
  const [activeBreaches, setActiveBreaches] = useState<string[]>([]);

  // 1. Load alerts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setAlerts(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Could not read price alerts from storage:', e);
    }
  }, []);

  // 2. Persist alerts to localStorage
  const saveAlerts = (updated: PriceAlert[]) => {
    setAlerts(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save price alerts to storage:', e);
    }
  };

  // 3. Request browser notification permission
  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationStatus(perm);
      } catch (err) {
        console.warn('Notification permission error:', err);
      }
    }
  };

  // 4. Evaluate breaches against live rates
  useEffect(() => {
    const breaches: string[] = [];
    alerts.forEach((alert) => {
      const currentPrice = rates[alert.token];
      if (evaluatePriceAlert(alert, currentPrice)) {
        breaches.push(alert.id);
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(`TrustPay Price Alert: ${alert.token}`, {
            body: `${alert.token} is now $${currentPrice.toFixed(4)} (${alert.condition.toLowerCase()} target $${alert.threshold}). Optimal funding window open!`,
            icon: '/favicon.ico',
          });
        }
      }
    });
    setActiveBreaches(breaches);
  }, [rates, alerts]);

  // 5. Add Alert Handler
  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(thresholdInput);
    if (isNaN(val) || val <= 0) return;

    const newAlert: PriceAlert = {
      id: `alert-${Date.now()}`,
      token: selectedToken,
      condition,
      threshold: val,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    saveAlerts([...alerts, newAlert]);
    setThresholdInput('');
  };

  // 6. Delete Alert Handler
  const handleDeleteAlert = (id: string) => {
    saveAlerts(alerts.filter((a) => a.id !== id));
  };

  // 7. Toggle Alert Active Status
  const handleToggleActive = (id: string) => {
    saveAlerts(
      alerts.map((a) => (a.id === id ? { ...a, isActive: !a.isActive } : a))
    );
  };

  return (
    <div
      data-testid="token-price-alert-widget"
      className="p-5 rounded-2xl bg-[#18181b]/90 border border-[#27272a] shadow-xl text-white space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="text-sm font-bold tracking-tight">Token Price & Funding Alert Trigger</h3>
        </div>
        <div className="text-[11px] text-[#a1a1aa] flex items-center space-x-2">
          <span>XLM: ${rates.XLM.toFixed(4)}</span>
          <span className="text-[#3f3f46]">|</span>
          <span>USDC: ${rates.USDC.toFixed(2)}</span>
        </div>
      </div>

      {/* Active Breach Banner */}
      {activeBreaches.length > 0 && (
        <div
          data-testid="price-breach-banner"
          className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs"
        >
          <div className="flex items-center space-x-2">
            <span className="text-blue-400 font-bold">Favorable Rate Detected:</span>
            <span className="text-[#e4e4e7]">Threshold criteria met for active alerts!</span>
          </div>
          <Link
            href="/projects/create"
            data-testid="fund-escrow-now-cta"
            className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-blue-600/20"
          >
            Fund Escrow Now ↗
          </Link>
        </div>
      )}

      {/* Alert Creator Form */}
      <form onSubmit={handleAddAlert} className="space-y-3" data-testid="alert-form">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label htmlFor={tokenSelectId} className="text-[11px] text-[#a1a1aa] block mb-1">
              Asset
            </label>
            <select
              id={tokenSelectId}
              data-testid="token-select"
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as 'XLM' | 'USDC' | 'EURC')}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="XLM">XLM (Stellar Lumens)</option>
              <option value="USDC">USDC (Stellar USD)</option>
              <option value="EURC">EURC (Stellar EUR)</option>
            </select>
          </div>

          <div>
            <label htmlFor={conditionSelectId} className="text-[11px] text-[#a1a1aa] block mb-1">
              Condition
            </label>
            <select
              id={conditionSelectId}
              data-testid="condition-select"
              value={condition}
              onChange={(e) => setCondition(e.target.value as 'ABOVE' | 'BELOW')}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ABOVE">Rises Above (&gt;=)</option>
              <option value="BELOW">Drops Below (&lt;=)</option>
            </select>
          </div>

          <div>
            <label htmlFor={thresholdInputId} className="text-[11px] text-[#a1a1aa] block mb-1">
              Target Price (USD)
            </label>
            <input
              id={thresholdInputId}
              type="number"
              step="0.0001"
              min="0"
              data-testid="threshold-input"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              placeholder="e.g. 0.1500"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={requestNotificationPermission}
            className="text-[11px] text-[#71717a] hover:text-[#a1a1aa] transition-colors"
          >
            {notificationStatus === 'granted'
              ? 'Push Notifications Active'
              : 'Enable Browser Push Notifications'}
          </button>
          <button
            type="submit"
            data-testid="add-alert-button"
            className="px-4 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Add Alert
          </button>
        </div>
      </form>

      {/* Alerts List */}
      <div className="space-y-2 pt-2 border-t border-[#27272a]/60">
        <div className="text-[11px] text-[#a1a1aa] font-semibold uppercase tracking-wider">
          Configured Thresholds ({alerts.length})
        </div>

        {alerts.length === 0 ? (
          <div className="text-xs text-[#71717a] py-3 text-center">
            No price alerts configured. Add a threshold above to trigger automatic notifications.
          </div>
        ) : (
          <div className="space-y-1.5" data-testid="alerts-list">
            {alerts.map((alert) => {
              const isBreached = activeBreaches.includes(alert.id);
              return (
                <div
                  key={alert.id}
                  data-testid={`alert-item-${alert.id}`}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                    isBreached
                      ? 'bg-blue-600/10 border-blue-500/40 text-blue-200'
                      : alert.isActive
                      ? 'bg-[#09090b]/80 border-[#27272a] text-[#e4e4e7]'
                      : 'bg-[#09090b]/40 border-[#27272a]/50 text-[#71717a]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isBreached
                          ? 'bg-blue-400 animate-ping'
                          : alert.isActive
                          ? 'bg-emerald-400'
                          : 'bg-[#52525b]'
                      }`}
                    />
                    <span className="font-bold text-xs">{alert.token}</span>
                    <span className="text-xs text-[#a1a1aa]">
                      {alert.condition === 'ABOVE' ? '>=' : '<='} ${alert.threshold.toFixed(4)}
                    </span>
                    {isBreached && (
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">
                        TRIGGERED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      data-testid={`toggle-alert-${alert.id}`}
                      onClick={() => handleToggleActive(alert.id)}
                      className="text-[11px] text-[#a1a1aa] hover:text-white transition-colors"
                    >
                      {alert.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      data-testid={`delete-alert-${alert.id}`}
                      onClick={() => handleDeleteAlert(alert.id)}
                      className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
