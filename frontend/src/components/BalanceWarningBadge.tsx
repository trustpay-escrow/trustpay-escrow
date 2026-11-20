'use client';

import React from 'react';
import { Networks } from '@stellar/stellar-sdk';
import { STELLAR_NETWORK_PASSPHRASE } from '@/lib/soroban';

export interface BalanceWarningBadgeProps {
  budget: number;
  balance: number | null;
  token: string;
  address?: string | null;
  isLoading?: boolean;
  loading?: boolean;
  error?: string | null;
  className?: string;
  showSufficientState?: boolean;
  faucetUrl?: string;
  isTestnet?: boolean;
  onRefresh?: () => void;
}

function formatAmount(value: number): string {
  const numeric = Number(value) || 0;
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 7 });
}

export function getShortfall(balance: number | null, budget: number): number {
  const requiredNumber = Number(budget);
  const availableNumber = Number(balance);
  const required = Number.isFinite(requiredNumber) && requiredNumber > 0 ? requiredNumber : 0;
  const available = Number.isFinite(availableNumber) && availableNumber > 0 ? availableNumber : 0;
  return Math.max(0, Number((required - available).toFixed(7)));
}

export function getFriendbotUrl(address: string): string {
  return `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`;
}

export function isTestnetNetwork(): boolean {
  return STELLAR_NETWORK_PASSPHRASE === Networks.TESTNET;
}

export function BalanceWarningBadge({
  budget,
  balance,
  token,
  address,
  isLoading = false,
  loading,
  error = null,
  className = '',
  showSufficientState = true,
  faucetUrl,
  isTestnet,
  onRefresh,
}: BalanceWarningBadgeProps) {
  const isCurrentlyLoading = isLoading || Boolean(loading);
  const shortfall = getShortfall(balance, budget);
  const hasBudget = Number(budget) > 0;
  const testnet = isTestnet ?? isTestnetNetwork();
  const friendbotUrl = faucetUrl || (address ? getFriendbotUrl(address) : '');

  if (isCurrentlyLoading) {
    return (
      <div
        data-testid="balance-check-loading"
        className={`flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3.5 py-2.5 text-xs text-slate-300 ${className}`}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
        Checking {token} wallet balance...
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="balance-check-error"
        role="status"
        className={`rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-300 ${className}`}
      >
        Could not verify your {token} balance. {error}
      </div>
    );
  }

  if (!hasBudget || shortfall === 0) {
    if (!showSufficientState || !hasBudget) return null;
    return (
      <div
        data-testid="balance-sufficient"
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300 ${className}`}
      >
        <span className="font-semibold">Sufficient balance</span>
        <span className="text-emerald-400/80">
          {formatAmount(balance ?? 0)} {token} available for a {formatAmount(budget)} {token} escrow.
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="balance-warning-badge"
      role="alert"
      className={`rounded-xl border border-red-500/50 bg-red-950/50 p-3.5 shadow-lg shadow-red-950/20 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-bold text-red-300">
            <span aria-hidden="true">⚠️</span>
            Insufficient {token} balance
          </p>
          <p className="text-xs text-red-200/90" data-testid="balance-shortfall">
            Wallet balance: <strong className="font-mono text-white">{formatAmount(balance ?? 0)} {token}</strong>
            {' • '}Budget: <strong className="font-mono text-white">{formatAmount(budget)} {token}</strong>
            {' • '}You need{' '}
            <strong className="font-mono text-red-300" data-testid="balance-missing-amount">
              {formatAmount(shortfall)} {token}
            </strong>{' '}
            more to lock this escrow.
          </p>
        </div>

        {testnet && friendbotUrl && (
          <a
            data-testid="balance-faucet-link"
            href={friendbotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-400/40 bg-red-600/80 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-red-500"
          >
            <span aria-hidden="true">🚰</span>
            Fund with Faucet
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </div>
  );
}

export default BalanceWarningBadge;
