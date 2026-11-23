'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RetainerConfig } from '@/types';
import {
  DEFAULT_TERMINATION_NOTICE_DAYS,
  RETAINER_FREQUENCIES,
  RetainerFrequency,
  generateRetainerSchedule,
  getDaysUntil,
  getRetainerTerminationDate,
  toRetainerIsoDate,
  validateRetainerConfig,
} from '@/lib/retainer';

export interface RetainerAgreementCardProps {
  agreement: RetainerConfig;
  token?: string;
  now?: string | Date;
  isSubmitting?: boolean;
  className?: string;
  onRenew?: (agreement: RetainerConfig) => void | Promise<void>;
  onTerminate?: (effectiveDate: string, agreement: RetainerConfig) => void | Promise<void>;
}

function formatCurrency(value: number, token: string): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${token}`;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function statusBadge(status: RetainerConfig['status']) {
  switch (status) {
    case 'completed':
      return { label: 'Completed', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' };
    case 'terminated':
      return { label: 'Termination scheduled', className: 'border-rose-500/40 bg-rose-500/10 text-rose-300' };
    default:
      return { label: 'Active retainer', className: 'border-sky-500/40 bg-sky-500/10 text-sky-300' };
  }
}

/** Recurring escrow / retainer summary with renewal and 7-day termination notice (#149). */
export function RetainerAgreementCard({
  agreement,
  token = agreement.token || 'USDC',
  now = new Date(),
  isSubmitting = false,
  className = '',
  onRenew,
  onTerminate,
}: RetainerAgreementCardProps) {
  const [showAll, setShowAll] = useState(false);
  const [confirmTerminate, setConfirmTerminate] = useState(false);
  const [error, setError] = useState('');

  const schedule = useMemo(
    () =>
      generateRetainerSchedule(
        {
          frequency: agreement.frequency,
          cycles: agreement.cycles,
          amountPerCycle: agreement.amountPerCycle,
          startDate: agreement.startDate,
        },
        now
      ),
    [agreement, now]
  );

  const completedCycles = Math.max(0, agreement.completedCycles || 0);
  const status = agreement.status || 'active';
  const badge = statusBadge(status);
  const daysUntilNext = schedule.nextFundingDate
    ? getDaysUntil(schedule.nextFundingDate, now)
    : null;
  const effectiveTerminationDate = getRetainerTerminationDate(now, DEFAULT_TERMINATION_NOTICE_DAYS);
  const canRenew = status === 'completed' || completedCycles >= agreement.cycles;
  const visibleEntries = showAll ? schedule.entries : schedule.entries.slice(0, 3);
  const progress = agreement.cycles > 0
    ? Math.min(100, (completedCycles / agreement.cycles) * 100)
    : 0;

  const handleTerminate = async () => {
    if (!onTerminate) return;
    if (!confirmTerminate) {
      setConfirmTerminate(true);
      return;
    }
    setError('');
    try {
      await onTerminate(effectiveTerminationDate, agreement);
      setConfirmTerminate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule termination');
    }
  };

  return (
    <section
      data-testid="retainer-agreement-card"
      aria-label="Retainer agreement"
      className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl sm:p-6 ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Recurring retainer
          </p>
          <h3 className="mt-1 text-lg font-bold text-white">
            {formatCurrency(agreement.amountPerCycle, token)}{' '}
            <span className="text-sm font-medium text-slate-400">
              / {RETAINER_FREQUENCIES[agreement.frequency].label.toLowerCase()}
            </span>
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {agreement.cycles} cycle{agreement.cycles === 1 ? '' : 's'} · starts{' '}
            {formatDate(agreement.startDate)}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${badge.className}`}>
          {badge.label}
        </span>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <dt className="text-slate-500">Total obligation</dt>
          <dd className="mt-1 font-mono text-sm font-bold text-white" data-testid="retainer-total">
            {formatCurrency(schedule.totalObligation, token)}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <dt className="text-slate-500">Next funding</dt>
          <dd className="mt-1 text-sm font-bold text-sky-300" data-testid="retainer-next-funding">
            {schedule.nextFundingDate ? formatDate(schedule.nextFundingDate) : 'All cycles funded'}
          </dd>
          {daysUntilNext !== null && (
            <dd className="mt-0.5 text-[11px] text-slate-500">
              {daysUntilNext === 0 ? 'Due today' : `in ${daysUntilNext} day${daysUntilNext === 1 ? '' : 's'}`}
            </dd>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <dt className="text-slate-500">Cycles completed</dt>
          <dd className="mt-1 font-mono text-sm font-bold text-emerald-300" data-testid="retainer-completed">
            {completedCycles} / {agreement.cycles}
          </dd>
        </div>
      </dl>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Funding schedule
          </h4>
          {schedule.entries.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200"
            >
              {showAll ? 'Show less' : `Show all ${schedule.entries.length}`}
            </button>
          )}
        </div>
        <ol className="mt-2 space-y-1.5" data-testid="retainer-schedule">
          {visibleEntries.map((entry) => (
            <li
              key={entry.cycle}
              className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-1.5 text-[11px]"
            >
              <span className="flex items-center gap-2 text-slate-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 font-mono text-[9px] font-bold text-slate-300">
                  {entry.cycle}
                </span>
                {formatDate(entry.date)}
              </span>
              <span className="font-mono text-slate-300">{formatCurrency(entry.amount, token)}</span>
            </li>
          ))}
        </ol>
      </div>

      {(onRenew || onTerminate) && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
          {onRenew && (
            <button
              type="button"
              onClick={() => onRenew(agreement)}
              disabled={!canRenew || isSubmitting}
              data-testid="retainer-renew"
              title={canRenew ? 'Start a new retainer with the same terms' : 'Available after the final cycle concludes'}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🔁 Renew Retainer
            </button>
          )}

          {onTerminate && status === 'active' && (
            <>
              <button
                type="button"
                onClick={handleTerminate}
                disabled={isSubmitting}
                data-testid="retainer-terminate"
                className={`rounded-xl border px-4 py-2 text-xs font-bold transition-colors disabled:opacity-40 ${
                  confirmTerminate
                    ? 'border-rose-500 bg-rose-600 text-white hover:bg-rose-500'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                }`}
              >
                {confirmTerminate ? 'Confirm termination' : 'Terminate future cycles'}
              </button>
              {confirmTerminate && (
                <button
                  type="button"
                  onClick={() => setConfirmTerminate(false)}
                  className="text-[11px] font-semibold text-slate-400 hover:text-white"
                >
                  Keep retainer
                </button>
              )}
              <p className="w-full text-[11px] text-slate-500" data-testid="retainer-notice">
                {DEFAULT_TERMINATION_NOTICE_DAYS}-day notice required. If confirmed today, future
                cycles stop after <strong className="text-slate-300">{formatDate(effectiveTerminationDate)}</strong>.
                Current-cycle work already funded is unaffected.
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] text-rose-400">
          {error}
        </p>
      )}
    </section>
  );
}

export interface RetainerAgreementFormProps {
  tokenOptions?: string[];
  initialConfig?: Partial<RetainerConfig>;
  isSubmitting?: boolean;
  onSubmit: (config: RetainerConfig) => void | Promise<void>;
  /** Keeps a live preview (e.g. RetainerAgreementCard) in sync with the form. */
  onPreviewChange?: (config: Partial<RetainerConfig>) => void;
}

function todayIso(): string {
  return toRetainerIsoDate(new Date());
}

/** Setup form for weekly/bi-weekly/monthly retainer escrows (#149). */
export function RetainerAgreementForm({
  tokenOptions = ['USDC', 'EURC', 'XLM', 'PYUSD'],
  initialConfig,
  isSubmitting = false,
  onSubmit,
  onPreviewChange,
}: RetainerAgreementFormProps) {
  const [frequency, setFrequency] = useState<RetainerFrequency>(initialConfig?.frequency || 'monthly');
  const [cycles, setCycles] = useState<string>(String(initialConfig?.cycles ?? 3));
  const [amount, setAmount] = useState<string>(
    initialConfig?.amountPerCycle ? String(initialConfig.amountPerCycle) : ''
  );
  const [startDate, setStartDate] = useState(initialConfig?.startDate || todayIso());
  const [token, setToken] = useState(initialConfig?.token || tokenOptions[0] || 'USDC');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parsedCycles = Number(cycles);
  const parsedAmount = Number(amount);
  const previewChangeRef = useRef(onPreviewChange);

  useEffect(() => {
    previewChangeRef.current = onPreviewChange;
  }, [onPreviewChange]);

  useEffect(() => {
    previewChangeRef.current?.({
      frequency,
      cycles: Number.isFinite(parsedCycles) ? Math.max(0, parsedCycles) : 0,
      amountPerCycle: Number.isFinite(parsedAmount) ? Math.max(0, parsedAmount) : 0,
      startDate,
      token,
    });
  }, [frequency, cycles, amount, startDate, token, parsedCycles, parsedAmount]);
  const previewTotal =
    Number.isFinite(parsedCycles) && Number.isFinite(parsedAmount)
      ? Math.max(0, parsedCycles) * Math.max(0, parsedAmount)
      : 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = validateRetainerConfig({
      frequency,
      cycles: parsedCycles,
      amountPerCycle: parsedAmount,
      startDate,
      token,
    });

    if (!result.valid) {
      setErrors(result.errors as Record<string, string>);
      return;
    }

    setErrors({});
    await onSubmit({
      frequency,
      cycles: parsedCycles,
      amountPerCycle: parsedAmount,
      startDate,
      token,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="retainer-agreement-form"
      className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl sm:p-6"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="retainer-frequency" className="mb-1.5 block text-xs font-semibold text-slate-200">
            Funding frequency
          </label>
          <select
            id="retainer-frequency"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as RetainerFrequency)}
            data-testid="retainer-frequency"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
          >
            {(Object.keys(RETAINER_FREQUENCIES) as RetainerFrequency[]).map((key) => (
              <option key={key} value={key}>
                {RETAINER_FREQUENCIES[key].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="retainer-cycles" className="mb-1.5 block text-xs font-semibold text-slate-200">
            Number of cycles
          </label>
          <input
            id="retainer-cycles"
            type="number"
            min={1}
            max={60}
            step={1}
            value={cycles}
            onChange={(event) => setCycles(event.target.value)}
            data-testid="retainer-cycles"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
          />
          {errors.cycles && (
            <p role="alert" data-testid="retainer-cycles-error" className="mt-1 text-[11px] text-rose-400">
              {errors.cycles}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label htmlFor="retainer-token" className="mb-1.5 block text-xs font-semibold text-slate-200">
            Token
          </label>
          <select
            id="retainer-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
          >
            {tokenOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="retainer-amount" className="mb-1.5 block text-xs font-semibold text-slate-200">
            Amount per cycle
          </label>
          <input
            id="retainer-amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="1500"
            data-testid="retainer-amount"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          {errors.amountPerCycle && (
            <p role="alert" data-testid="retainer-amount-error" className="mt-1 text-[11px] text-rose-400">
              {errors.amountPerCycle}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="retainer-start" className="mb-1.5 block text-xs font-semibold text-slate-200">
            First funding date
          </label>
          <input
            id="retainer-start"
            type="date"
            value={startDate}
            min={todayIso()}
            onChange={(event) => setStartDate(event.target.value)}
            data-testid="retainer-start"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
          />
          {errors.startDate && (
            <p role="alert" data-testid="retainer-start-error" className="mt-1 text-[11px] text-rose-400">
              {errors.startDate}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
        <div className="text-xs text-indigo-200">
          Total contract obligation
          <p className="font-mono text-base font-bold text-white" data-testid="retainer-form-total">
            {previewTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {token}
          </p>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Creating retainer…' : 'Create retainer escrow'}
        </button>
      </div>
    </form>
  );
}

export default RetainerAgreementCard;
