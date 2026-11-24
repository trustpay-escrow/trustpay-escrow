'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Project } from '@/types';
import { useWalletStore } from '@/store/walletStore';
import {
  BULK_PAYOUT_PROGRESS,
  calculateBulkPayoutTotals,
  collectBulkPayoutMilestones,
  executeBulkPayout,
  type BulkPayoutMilestone,
  type BulkPayoutResult,
} from '@/lib/bulk-payout';
import { DEFAULT_SOROBAN_BASE_FEE, getStellarExplorerUrl, type TxStage } from '@/lib/soroban';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useA11yAnnouncer } from './A11yLiveAnnouncer';
import { StatusBadge } from './StatusBadge';

export interface BulkMilestonePayoutManagerProps {
  projects?: Project[];
  isOpen: boolean;
  onClose: () => void;
  /** Client wallet balance for the selected token, when known. */
  balance?: number | null;
  /** Overrides the connected wallet (used in tests). */
  callerAddress?: string;
  onComplete?: (result: BulkPayoutResult) => void;
}

interface PayoutProgress {
  percent: number;
  stage: TxStage | 'idle';
  message: string;
}

const IDLE_PROGRESS: PayoutProgress = {
  percent: 0,
  stage: 'idle',
  message: '',
};

/**
 * BulkMilestonePayoutManager (#308)
 *
 * Multi-select dashboard for enterprise clients: approves and releases every
 * submitted milestone in one atomic Soroban transaction, with live payout
 * totals, fee estimate, unified progress and a completion receipt.
 */
export function BulkMilestonePayoutManager({
  projects = [],
  isOpen,
  onClose,
  balance,
  callerAddress,
  onComplete,
}: BulkMilestonePayoutManagerProps) {
  const { address } = useWalletStore();
  const { announce } = useA11yAnnouncer();
  const effectiveAddress = callerAddress || address || '';
  const dialogRef = useFocusTrap<HTMLDivElement>({ active: isOpen, onEscape: onClose });

  const allMilestones = useMemo(() => collectBulkPayoutMilestones(projects), [projects]);
  const tokens = useMemo(
    () => Array.from(new Set(allMilestones.map((milestone) => milestone.token))),
    [allMilestones]
  );

  const [token, setToken] = useState<string>('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<PayoutProgress>(IDLE_PROGRESS);
  const [receipt, setReceipt] = useState<BulkPayoutResult | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false);
      setProgress(IDLE_PROGRESS);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!token && tokens.length > 0) setToken(tokens[0]);
  }, [token, tokens]);

  const tokenMilestones = useMemo(
    () =>
      allMilestones
        .filter((milestone) => !token || milestone.token === token)
        .filter((milestone) =>
          search.trim()
            ? `${milestone.projectTitle} ${milestone.milestoneTitle} ${milestone.freelancerAddress || ''}`
                .toLowerCase()
                .includes(search.trim().toLowerCase())
            : true
        ),
    [allMilestones, token, search]
  );

  const selectedMilestones = useMemo(
    () => allMilestones.filter((milestone) => selectedKeys.has(milestone.key)),
    [allMilestones, selectedKeys]
  );

  const totals = useMemo(
    () =>
      calculateBulkPayoutTotals(selectedMilestones, {
        balance,
        token: token || undefined,
        baseFeeStroops: DEFAULT_SOROBAN_BASE_FEE,
      }),
    [selectedMilestones, balance, token]
  );

  if (!isOpen) return null;

  const allVisibleSelected =
    tokenMilestones.length > 0 && tokenMilestones.every((milestone) => selectedKeys.has(milestone.key));

  const toggleMilestone = (milestone: BulkPayoutMilestone) => {
    setReceipt(null);
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(milestone.key)) {
        next.delete(milestone.key);
      } else {
        next.add(milestone.key);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setReceipt(null);
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) {
        tokenMilestones.forEach((milestone) => next.delete(milestone.key));
      } else {
        tokenMilestones.forEach((milestone) => next.add(milestone.key));
      }
      return next;
    });
  };

  const handleExecute = async () => {
    if (selectedMilestones.length === 0) {
      toast.warning('Select at least one submitted milestone.');
      return;
    }
    if (!effectiveAddress) {
      toast.error('Connect your client wallet first.');
      return;
    }

    setSubmitting(true);
    setReceipt(null);
    setProgress({ percent: BULK_PAYOUT_PROGRESS.preparing, stage: 'preparing', message: 'Preparing batch payout…' });
    announce(`Submitting batch payout for ${selectedMilestones.length} milestones.`);

    try {
      const result = await executeBulkPayout({
        callerAddress: effectiveAddress,
        milestones: selectedMilestones,
        balance,
        onProgress: (percent, stage, message) => {
          setProgress({ percent, stage, message });
        },
      });

      setProgress({ percent: 100, stage: 'success', message: 'Batch payout confirmed on Stellar.' });
      setReceipt(result);
      announce(`Batch payout confirmed for ${result.approvedCount} milestones.`);
      toast.success(`Batch payout confirmed: ${result.approvedCount} milestone(s) released.`);
      setSelectedKeys(new Set());
      onComplete?.(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProgress({ percent: 100, stage: 'error', message });
      announce(`Batch payout failed: ${message}`, 'assertive');
      toast.error(`Batch payout failed: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
      data-testid="bulk-payout-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-payout-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full max-w-5xl space-y-5 overflow-y-auto rounded-2xl border border-slate-700 bg-[#101014] p-4 shadow-2xl custom-scrollbar sm:p-6"
        data-testid="bulk-payout-manager"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="bulk-payout-title" className="text-lg font-bold text-white sm:text-xl">
              Bulk Milestone Payout
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Approve and release multiple submitted milestones in a single wallet signature.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bulk payout manager"
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {allMilestones.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-10 text-center text-sm text-slate-400">
            No submitted milestones are awaiting payout.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="bulk-payout-search">
                Search milestones
              </label>
              <input
                id="bulk-payout-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search project, milestone or freelancer…"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              {tokens.length > 1 && (
                <select
                  aria-label="Filter by settlement token"
                  value={token}
                  onChange={(event) => {
                    setToken(event.target.value);
                    setSelectedKeys(new Set());
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {tokens.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={submitting || tokenMilestones.length === 0}
                data-testid="bulk-select-all"
                className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-40"
              >
                {allVisibleSelected ? 'Clear All' : 'Select All'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="bulk-payout-totals">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Selected</p>
                <p className="mt-1 text-xl font-bold text-white" data-testid="bulk-selected-count">
                  {selectedMilestones.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Payout total</p>
                <p className="mt-1 text-xl font-bold text-emerald-400" data-testid="bulk-payout-total">
                  {totals.payoutTotal.toLocaleString()} {totals.token}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Network fee</p>
                <p className="mt-1 text-xl font-bold text-blue-300" data-testid="bulk-network-fee">
                  {totals.networkFeeXlm} XLM
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Remaining balance</p>
                <p
                  className={`mt-1 text-xl font-bold ${
                    totals.exceedsBalance ? 'text-rose-400' : 'text-slate-200'
                  }`}
                  data-testid="bulk-remaining-balance"
                >
                  {totals.remainingBalance === null
                    ? '—'
                    : `${totals.remainingBalance.toLocaleString()} ${totals.token}`}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800">
              <ul className="divide-y divide-slate-800" data-testid="bulk-payout-list">
                {tokenMilestones.map((milestone) => (
                  <li
                    key={milestone.key}
                    className="flex flex-col gap-2 bg-slate-950/40 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <label className="flex flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-emerald-500"
                        checked={selectedKeys.has(milestone.key)}
                        onChange={() => toggleMilestone(milestone)}
                        disabled={submitting}
                        aria-label={`Select ${milestone.projectTitle} ${milestone.milestoneTitle}`}
                        data-testid={`bulk-select-${milestone.key}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          {milestone.projectTitle}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          #{milestone.milestoneIndex + 1} · {milestone.milestoneTitle}
                        </span>
                        {milestone.freelancerAddress && (
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">
                            {milestone.freelancerAddress}
                          </span>
                        )}
                      </span>
                    </label>
                    <div className="flex items-center gap-3 sm:justify-end">
                      <span className="text-sm font-bold text-white">
                        {milestone.amount.toLocaleString()} {milestone.token}
                      </span>
                      <StatusBadge status="submitted" size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {progress.stage !== 'idle' && (
              <div className="space-y-2" data-testid="bulk-payout-progress">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-slate-400">
                    {progress.stage}
                  </span>
                  <span className="text-slate-500">{progress.percent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percent}
                  aria-label="Batch payout progress"
                  className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      progress.stage === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400" aria-live="polite">
                  {progress.message}
                </p>
              </div>
            )}

            {receipt && (
              <div
                className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-100"
                data-testid="bulk-payout-receipt"
              >
                <p className="text-sm font-bold text-emerald-300">
                  Batch complete · {receipt.approvedCount} milestone(s) released
                </p>
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    Total settled: {receipt.totals.payoutTotal.toLocaleString()} {receipt.totals.token}
                  </span>
                  <a
                    href={getStellarExplorerUrl(receipt.txHash, 'tx')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-cyan-300 underline underline-offset-2"
                  >
                    View tx on Stellar Expert ↗
                  </a>
                </div>
                <p className="font-mono break-all text-[10px] text-emerald-200/70">{receipt.txHash}</p>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-slate-500">
                One signature releases every selected milestone atomically.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void handleExecute()}
                  disabled={submitting || selectedMilestones.length === 0 || totals.exceedsBalance}
                  data-testid="bulk-execute"
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-bold text-white transition-all hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? 'Processing batch…'
                    : `Release ${selectedMilestones.length} milestone(s) in one signature`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default BulkMilestonePayoutManager;
