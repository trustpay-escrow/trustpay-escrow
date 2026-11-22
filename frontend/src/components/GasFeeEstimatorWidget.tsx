'use client';

import React, { useEffect, useState } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  FEE_MULTIPLIERS,
  FEE_TIERS,
  FEE_TIER_LABELS,
  buildFeeSelection,
  estimateInclusionSeconds,
  formatStroops,
  stroopsToXlm,
  type FeeSelection,
  type FeeTier,
} from '@/lib/fee-estimator';

export interface GasFeeEstimatorWidgetProps {
  /** Called with the chosen preset whenever it (or the network fee) changes. */
  onChange?: (selection: FeeSelection) => void;
  defaultTier?: FeeTier;
  className?: string;
}

/**
 * Live Stellar network fee gauge with Standard / Fast / Urgent presets (#256).
 * The selection is reported through `onChange` so the parent can apply it to
 * Soroban invocation envelopes (see `setSorobanBaseFee`).
 */
export function GasFeeEstimatorWidget({
  onChange,
  defaultTier = 'standard',
  className = '',
}: GasFeeEstimatorWidgetProps) {
  const { fees, loading, error, refresh } = useNetworkStatus();
  const [tier, setTier] = useState<FeeTier>(defaultTier);

  useEffect(() => {
    if (fees) onChange?.(buildFeeSelection(fees, tier));
    // onChange is intentionally excluded: parents often pass inline callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fees?.baseFee, fees?.minBaseFee, tier]);

  return (
    <section
      className={`bg-[#18181b] border border-[#27272a] rounded-2xl p-5 space-y-4 ${className}`}
      aria-labelledby="gas-fee-heading"
      data-testid="gas-fee-widget"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="gas-fee-heading" className="text-sm font-bold text-white">
            Network fee
          </h3>
          <p className="text-[11px] text-[#71717a]">Average of the last 5 ledgers (Horizon)</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="text-[11px] text-[#a1a1aa] hover:text-white"
          aria-label="Refresh network fees"
        >
          ↻ Refresh
        </button>
      </div>

      {loading && !fees && (
        <p className="text-xs text-[#a1a1aa]" role="status">
          Loading network fees…
        </p>
      )}
      {error && !fees && (
        <p className="text-xs text-red-400" role="alert" data-testid="gas-fee-error">
          Couldn&apos;t load network fees. {error}
        </p>
      )}

      {fees && (
        <>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#1c1c20] border border-[#27272a] rounded-xl p-3">
              <dt className="text-[#71717a]">Base fee</dt>
              <dd className="text-white font-semibold" data-testid="gas-base-fee">
                {formatStroops(fees.baseFee)}
              </dd>
            </div>
            <div className="bg-[#1c1c20] border border-[#27272a] rounded-xl p-3">
              <dt className="text-[#71717a]">Surge fee</dt>
              <dd className="text-white font-semibold" data-testid="gas-surge-fee">
                {formatStroops(fees.surgeFee)}
              </dd>
            </div>
          </dl>

          {fees.isSurging && (
            <p
              className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-lg p-2"
              role="status"
              data-testid="gas-surge-warning"
            >
              The network is busy. Standard fees may take longer; consider Fast or Urgent.
            </p>
          )}

          <div role="radiogroup" aria-label="Transaction speed" className="grid grid-cols-3 gap-2">
            {FEE_TIERS.map((option) => {
              const selection = buildFeeSelection(fees, option);
              const seconds = estimateInclusionSeconds(option, fees.capacityUsage);
              const active = option === tier;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTier(option)}
                  data-testid={`fee-tier-${option}`}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-[#27272a] bg-[#1c1c20] text-[#a1a1aa] hover:border-[#3f3f46]'
                  }`}
                >
                  <span className="block text-xs font-bold">{FEE_TIER_LABELS[option]}</span>
                  <span className="block text-[10px] text-[#71717a]">
                    {FEE_MULTIPLIERS[option]}x base
                  </span>
                  <span className="block text-xs mt-1" data-testid={`fee-tier-${option}-fee`}>
                    {formatStroops(selection.feeStroops)}
                  </span>
                  <span className="block text-[10px] text-[#71717a]" data-testid={`fee-tier-${option}-eta`}>
                    ~{seconds}s
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-[#71717a]" data-testid="gas-selected-summary">
            Selected: {FEE_TIER_LABELS[tier]} ·{' '}
            {stroopsToXlm(buildFeeSelection(fees, tier).feeStroops).toFixed(7)} XLM per operation
          </p>
        </>
      )}
    </section>
  );
}
