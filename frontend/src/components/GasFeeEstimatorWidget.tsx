'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FeeSpeedTier,
  NetworkFeeStats,
  calculateFeeTiers,
  fetchStellarFeeStats,
} from '@/lib/soroban';

export interface GasFeeEstimatorWidgetProps {
  initialTier?: FeeSpeedTier;
  onFeeSelected?: (feeStroops: number, tier: FeeSpeedTier) => void;
  className?: string;
  autoRefreshIntervalMs?: number;
}

export function stroopsToXlm(stroops: number): string {
  const xlm = stroops / 10000000;
  return xlm.toFixed(7).replace(/\.?0+$/, '') || '0';
}

export const GasFeeEstimatorWidget: React.FC<GasFeeEstimatorWidgetProps> = ({
  initialTier = 'standard',
  onFeeSelected,
  className = '',
  autoRefreshIntervalMs = 0,
}) => {
  const [selectedTier, setSelectedTier] = useState<FeeSpeedTier>(initialTier);
  const [stats, setStats] = useState<NetworkFeeStats>({
    baseFeeStroops: 100,
    surgeMultiplier: 1.0,
    isSurgeActive: false,
    ledgerCapacityUsage: 0.12,
    tiers: calculateFeeTiers(100),
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadFeeStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchStellarFeeStats();
      setStats(data);
      setLastUpdated(new Date());
      if (onFeeSelected) {
        onFeeSelected(data.tiers[selectedTier].feeStroops, selectedTier);
      }
    } catch {
      // Fallback state is preserved
    } finally {
      setIsLoading(false);
    }
  }, [selectedTier, onFeeSelected]);

  useEffect(() => {
    loadFeeStats();
  }, []);

  useEffect(() => {
    if (autoRefreshIntervalMs > 0) {
      const interval = setInterval(loadFeeStats, autoRefreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [autoRefreshIntervalMs, loadFeeStats]);

  const handleSelectTier = (tier: FeeSpeedTier) => {
    setSelectedTier(tier);
    if (onFeeSelected && stats.tiers[tier]) {
      onFeeSelected(stats.tiers[tier].feeStroops, tier);
    }
  };

  const activeFeeStroops = stats.tiers[selectedTier]?.feeStroops || 100;
  const activeFeeXlm = stroopsToXlm(activeFeeStroops);

  return (
    <div
      className={`rounded-xl border border-border/80 bg-card p-4 text-card-foreground shadow-sm ${className}`}
      data-testid="gas-fee-estimator-widget"
    >
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              stats.isSurgeActive ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
            }`}
            data-testid="network-status-indicator"
          />
          <h4 className="text-sm font-semibold tracking-tight">Stellar Gas & Fee Estimator</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground" data-testid="last-updated-text">
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            type="button"
            onClick={loadFeeStats}
            disabled={isLoading}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh fee stats"
            aria-label="Refresh fees"
            data-testid="refresh-fees-btn"
          >
            <svg
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {stats.isSurgeActive && (
        <div
          className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2"
          data-testid="surge-warning-banner"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>
            Ledger congestion detected ({(stats.ledgerCapacityUsage * 100).toFixed(0)}% capacity). Surge pricing multiplier (
            {stats.surgeMultiplier}x) applied to base fee.
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mt-3">
        {(['standard', 'fast', 'urgent'] as FeeSpeedTier[]).map((tierKey) => {
          const tier = stats.tiers[tierKey];
          const isSelected = selectedTier === tierKey;
          const tierLabels: Record<FeeSpeedTier, { name: string; badge: string }> = {
            standard: { name: 'Standard', badge: 'Normal' },
            fast: { name: 'Fast', badge: '1.5x' },
            urgent: { name: 'Urgent', badge: '2.0x' },
          };

          return (
            <button
              key={tierKey}
              type="button"
              onClick={() => handleSelectTier(tierKey)}
              className={`flex flex-col p-2.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
                  : 'border-border/60 hover:border-border hover:bg-muted/40'
              }`}
              data-testid={`fee-tier-btn-${tierKey}`}
              aria-pressed={isSelected}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold capitalize">{tierLabels[tierKey].name}</span>
                <span className="text-[10px] px-1 py-0.5 rounded bg-muted font-mono text-muted-foreground">
                  {tierLabels[tierKey].badge}
                </span>
              </div>
              <div className="mt-1 text-sm font-bold font-mono text-foreground">
                {tier.feeStroops}{' '}
                <span className="text-[10px] font-normal text-muted-foreground">stroops</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground flex items-center justify-between">
                <span>~{tier.estimatedTimeSec}s</span>
                <span>{stroopsToXlm(tier.feeStroops)} XLM</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <span>Selected Fee Allowance:</span>
        <span className="font-mono font-medium text-foreground" data-testid="selected-fee-summary">
          {activeFeeStroops} stroops ({activeFeeXlm} XLM)
        </span>
      </div>
    </div>
  );
};
