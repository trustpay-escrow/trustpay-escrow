'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';

export interface ContractTtlWarningProps {
  contractId?: string;
  currentLedger?: number;
  expirationLedger?: number;
  warningThreshold?: number; // default: 20000 ledgers (~28 hours at 5s/ledger)
  onBumpSuccess?: (newExpirationLedger: number) => void;
  className?: string;
}

export function ContractTtlWarning({
  contractId = 'C...ESCRW',
  currentLedger = 1045230,
  expirationLedger = 1060230, // 15,000 ledgers left (< 20,000)
  warningThreshold = 20000,
  onBumpSuccess,
  className = '',
}: ContractTtlWarningProps) {
  const [currentExp, setCurrentExp] = useState<number>(expirationLedger);
  const [isBumping, setIsBumping] = useState<boolean>(false);

  const remainingLedgers = Math.max(0, currentExp - currentLedger);
  const isExpiringSoon = remainingLedgers < warningThreshold;
  const hoursRemaining = ((remainingLedgers * 5) / 3600).toFixed(1);

  const handleBumpTtl = async () => {
    setIsBumping(true);
    try {
      // Simulate Soroban RPC extend_ttl bump call
      await new Promise((resolve) => setTimeout(resolve, 800));
      const bumpedExpiration = currentExp + 518400; // Bump by ~30 days
      setCurrentExp(bumpedExpiration);
      toast.success(
        `Contract TTL extended successfully! New expiration ledger: #${bumpedExpiration.toLocaleString()}`
      );
      if (onBumpSuccess) {
        onBumpSuccess(bumpedExpiration);
      }
    } catch {
      toast.error('Failed to bump contract TTL. Please try again.');
    } finally {
      setIsBumping(false);
    }
  };

  if (!isExpiringSoon) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-2 text-xs text-emerald-400 ${className}`}>
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Contract Storage Healthy (Expires in {remainingLedgers.toLocaleString()} ledgers)</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 text-amber-200 backdrop-blur-md shadow-lg ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400 shrink-0">
            ⚠️
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-300">
              Contract State Archival Warning: Low Storage TTL
            </h4>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Contract entry expires in <strong className="font-semibold text-white">{remainingLedgers.toLocaleString()} ledgers</strong> (~{hoursRemaining} hours).
              Archived contracts require restoration before further interactions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:self-center">
          <button
            onClick={handleBumpTtl}
            disabled={isBumping}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md transition disabled:opacity-50"
          >
            {isBumping ? 'Extending Lifespan...' : '⚡ Bump Contract TTL'}
          </button>
        </div>
      </div>
    </div>
  );
}
