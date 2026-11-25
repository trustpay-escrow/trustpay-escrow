'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CurrencyAmountInput } from '@/components/CurrencyAmountInput';
import type { CounterOffer, CounterOfferAuthor, MilestoneTerms } from '@/lib/counter-offer';
import {
  buildCounterOfferDiff,
  createCounterOffer,
  normalizeMilestoneTerms,
  validateCounterOfferTerms,
} from '@/lib/counter-offer';

export interface ProposalCounterOfferModalProps {
  isOpen: boolean;
  proposal: {
    id: string;
    project_title?: string;
    freelancer_address?: string;
    stellar_address?: string;
    budget?: number;
    counter_offer?: CounterOffer | null;
  } | null;
  /** Original proposal/project terms that the counter-offer is compared against. */
  originalMilestones: MilestoneTerms[];
  tokenSymbol?: string;
  /** Which party is proposing the revised terms. Defaults to the client. */
  author?: CounterOfferAuthor;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (offer: CounterOffer) => void | Promise<void>;
}

function formatAmount(value: number, token: string): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${token}`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Client-side counter-offer editor with a live original-vs-revised diff (#150).
 */
export function ProposalCounterOfferModal({
  isOpen,
  proposal,
  originalMilestones,
  tokenSymbol = 'USDC',
  author = 'client',
  isSubmitting = false,
  onClose,
  onSubmit,
}: ProposalCounterOfferModalProps) {
  const original = useMemo(() => {
    if (originalMilestones && originalMilestones.length > 0) {
      return normalizeMilestoneTerms(originalMilestones);
    }
    return normalizeMilestoneTerms([
      {
        milestone_index: 0,
        title: proposal?.project_title || 'Project milestone',
        amount: proposal?.budget || 0,
      },
    ]);
  }, [originalMilestones, proposal]);

  // The parent remounts this modal (via `key`) when the proposal changes, so
  // initial state is derived once instead of being synchronised in an effect.
  const [terms, setTerms] = useState<MilestoneTerms[]>(() => {
    const existing = proposal?.counter_offer?.milestones;
    return existing && existing.length > 0
      ? normalizeMilestoneTerms(existing)
      : original;
  });
  const [note, setNote] = useState(proposal?.counter_offer?.note || '');
  const [error, setError] = useState('');

  const diff = useMemo(() => buildCounterOfferDiff(original, terms), [original, terms]);

  const updateTerm = (
    index: number,
    patch: Partial<Pick<MilestoneTerms, 'amount' | 'due_date'>>
  ) => {
    setTerms((prev) =>
      prev.map((term, termIndex) => (termIndex === index ? { ...term, ...patch } : term))
    );
    if (error) setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateCounterOfferTerms(terms);
    if (!validation.valid) {
      setError(Object.values(validation.errors)[0] || 'Check the counter-offer terms.');
      return;
    }
    if (!proposal) return;

    const offer = createCounterOffer(terms, author, note);
    const recipientLabel = author === 'freelancer' ? 'client' : 'freelancer';
    try {
      await onSubmit(offer);
      toast.success(`Counter-offer sent to the ${recipientLabel}`);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send the counter-offer';
      setError(message);
      toast.error(message);
    }
  };

  if (!isOpen || !proposal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="counter-offer-title"
        data-testid="proposal-counter-offer-modal"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-7 custom-scrollbar"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
              Counter-offer negotiation
            </span>
            <h2 id="counter-offer-title" className="mt-1 text-xl font-bold text-white">
              Revise proposal terms
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {proposal.project_title || 'Project proposal'} · the{' '}
              {author === 'freelancer' ? 'client' : 'freelancer'} must accept before escrow terms
              are locked.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close counter-offer modal"
            className="text-slate-500 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="space-y-3">
            {terms.map((term, index) => (
              <div
                key={term.milestone_index}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-200">
                    <span className="mr-2 rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                      #{term.milestone_index + 1}
                    </span>
                    {term.title}
                  </p>
                  <span className="text-[11px] text-slate-500">
                    Original: {formatAmount(original[index]?.amount ?? 0, tokenSymbol)}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`counter-amount-${index}`}
                      className="mb-1 block text-[11px] font-semibold text-slate-400"
                    >
                      Revised amount ({tokenSymbol})
                    </label>
                    <CurrencyAmountInput
                      id={`counter-amount-${index}`}
                      token={tokenSymbol}
                      min={0}
                      step="0.01"
                      value={Number.isFinite(term.amount) ? term.amount : ''}
                      onValueChange={(parsed) =>
                        updateTerm(index, { amount: parsed === '' ? 0 : parsed })
                      }
                      data-testid={`counter-amount-${index}`}
                      badgeTestId={`counter-amount-prefix-${index}`}
                      inputClassName="w-full rounded-xl border border-slate-800 bg-slate-950 pr-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`counter-due-${index}`}
                      className="mb-1 block text-[11px] font-semibold text-slate-400"
                    >
                      Revised due date
                    </label>
                    <input
                      id={`counter-due-${index}`}
                      type="date"
                      value={term.due_date || ''}
                      onChange={(event) => updateTerm(index, { due_date: event.target.value })}
                      data-testid={`counter-due-${index}`}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[520px] text-left text-[11px]">
              <caption className="sr-only">Original proposal versus counter-offer terms</caption>
              <thead className="bg-slate-950/80 text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Milestone</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Original</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Counter-offer</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Change</th>
                </tr>
              </thead>
              <tbody data-testid="counter-offer-diff" className="divide-y divide-slate-800">
                {diff.rows.map((row) => (
                  <tr key={row.milestone_index} data-testid={`counter-diff-row-${row.milestone_index}`}>
                    <td className="px-3 py-2 text-slate-300">{row.title}</td>
                    <td className="px-3 py-2 font-mono text-slate-400">
                      {formatAmount(row.originalAmount, tokenSymbol)}
                      <span className="block text-[10px] text-slate-600">
                        {formatDate(row.originalDueDate)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-white">
                      {formatAmount(row.counterAmount, tokenSymbol)}
                      <span className="block text-[10px] text-slate-500">
                        {formatDate(row.counterDueDate)}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 font-mono font-bold ${
                        row.amountDelta > 0
                          ? 'text-rose-300'
                          : row.amountDelta < 0
                            ? 'text-emerald-300'
                            : 'text-slate-500'
                      }`}
                    >
                      {row.amountDelta === 0
                        ? '—'
                        : `${row.amountDelta > 0 ? '+' : ''}${formatAmount(row.amountDelta, tokenSymbol)}`}
                      {row.dueDateDeltaDays !== null && row.dueDateDeltaDays !== 0 && (
                        <span className="block text-[10px] font-medium text-slate-500">
                          {row.dueDateDeltaDays > 0 ? '+' : ''}
                          {row.dueDateDeltaDays}d
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-950/80 text-xs">
                <tr>
                  <th scope="row" className="px-3 py-2 text-left font-semibold text-slate-400">
                    Total
                  </th>
                  <td className="px-3 py-2 font-mono text-slate-400" data-testid="counter-original-total">
                    {formatAmount(diff.originalTotal, tokenSymbol)}
                  </td>
                  <td className="px-3 py-2 font-mono font-bold text-white" data-testid="counter-new-total">
                    {formatAmount(diff.counterTotal, tokenSymbol)}
                  </td>
                  <td
                    className={`px-3 py-2 font-mono font-bold ${
                      diff.totalDelta > 0
                        ? 'text-rose-300'
                        : diff.totalDelta < 0
                          ? 'text-emerald-300'
                          : 'text-slate-500'
                    }`}
                    data-testid="counter-total-delta"
                  >
                    {diff.totalDelta === 0
                      ? 'No change'
                      : `${diff.totalDelta > 0 ? '+' : ''}${formatAmount(diff.totalDelta, tokenSymbol)} (${diff.totalDeltaPct > 0 ? '+' : ''}${diff.totalDeltaPct}%)`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <label htmlFor="counter-note" className="mb-1.5 block text-xs font-semibold text-slate-200">
              Negotiation note <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id="counter-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Explain the revised scope, budget, or delivery expectations..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Sending counter-offer…' : 'Send counter-offer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface CounterOfferSummaryProps {
  offer: CounterOffer;
  originalBudget?: number;
  tokenSymbol?: string;
  isSubmitting?: boolean;
  onAccept: () => void | Promise<void>;
  onDecline: () => void | Promise<void>;
  onRecounter?: () => void;
  className?: string;
}

/** Compact incoming counter-offer card with one-click accept / decline / re-counter. */
export function CounterOfferSummary({
  offer,
  originalBudget,
  tokenSymbol = 'USDC',
  isSubmitting = false,
  onAccept,
  onDecline,
  onRecounter,
  className = '',
}: CounterOfferSummaryProps) {
  const originalTotal =
    typeof originalBudget === 'number' && originalBudget > 0
      ? originalBudget
      : offer.total;
  const delta = Math.round((offer.total - originalTotal) * 100) / 100;

  return (
    <section
      data-testid="counter-offer-summary"
      aria-label="Incoming proposal counter-offer"
      className={`rounded-2xl border border-indigo-500/40 bg-indigo-950/30 p-4 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
            Counter-offer from {offer.proposed_by === 'freelancer' ? 'freelancer' : 'client'}
          </p>
          <p className="mt-1 text-sm font-bold text-white" data-testid="counter-summary-total">
            {formatAmount(offer.total, tokenSymbol)}
            <span className="ml-2 text-[11px] font-medium text-slate-400">
              was {formatAmount(originalTotal, tokenSymbol)}
            </span>
          </p>
          {delta !== 0 && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              {delta > 0 ? '+' : ''}
              {formatAmount(delta, tokenSymbol)} versus the original proposal
            </p>
          )}
        </div>
        <span className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold text-indigo-200">
          Awaiting response
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {offer.milestones.map((term) => (
          <li
            key={term.milestone_index}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-1.5 text-[11px]"
          >
            <span className="text-slate-300">{term.title}</span>
            <span className="font-mono text-slate-200">
              {formatAmount(term.amount, tokenSymbol)}
              {term.due_date && (
                <span className="ml-2 text-slate-500">{formatDate(term.due_date)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {offer.note && (
        <p className="mt-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">
          &quot;{offer.note}&quot;
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={isSubmitting}
          data-testid="counter-accept"
          className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          Accept terms
        </button>
        <button
          type="button"
          onClick={onDecline}
          disabled={isSubmitting}
          data-testid="counter-decline"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-1.5 text-[11px] font-bold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
        >
          Decline
        </button>
        {onRecounter && (
          <button
            type="button"
            onClick={onRecounter}
            disabled={isSubmitting}
            data-testid="counter-recounter"
            className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3.5 py-1.5 text-[11px] font-bold text-indigo-200 transition-colors hover:bg-indigo-500/20 disabled:opacity-50"
          >
            Re-counter
          </button>
        )}
      </div>
    </section>
  );
}

export default ProposalCounterOfferModal;
