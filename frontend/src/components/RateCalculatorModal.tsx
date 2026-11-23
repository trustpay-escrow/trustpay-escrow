'use client';

import { useMemo, useState } from 'react';
import { calculateProposalQuote } from '@/lib/proposal-calculations';

interface RateCalculatorModalProps {
  milestoneHours: number[];
  serviceFeeRate?: number;
  onApply?: (amounts: number[]) => void;
}

export function RateCalculatorModal({
  milestoneHours,
  serviceFeeRate = 0,
  onApply,
}: RateCalculatorModalProps) {
  const [hourlyRate, setHourlyRate] = useState('');
  const quote = useMemo(
    () => calculateProposalQuote(Number(hourlyRate), milestoneHours.map((hours, index) => ({ id: String(index), hours })), serviceFeeRate),
    [hourlyRate, milestoneHours, serviceFeeRate],
  );

  return (
    <section className="rounded-xl border border-[#27272a] bg-[#1c1c20] p-4 space-y-3" aria-label="Proposal rate calculator">
      <label className="block text-sm font-semibold text-white" htmlFor="hourly-rate">Hourly rate</label>
      <input
        id="hourly-rate"
        min="0"
        onChange={(event) => setHourlyRate(event.target.value)}
        placeholder="50"
        step="0.01"
        type="number"
        value={hourlyRate}
        className="w-full rounded-lg border border-[#3f3f46] bg-[#18181b] px-3 py-2 text-white"
      />
      <div className="grid grid-cols-3 gap-2 text-sm text-[#d4d4d8]">
        <span>Quote: ${quote.gross.toFixed(2)}</span>
        <span>Fee: ${quote.serviceFee.toFixed(2)}</span>
        <span>Net: ${quote.net.toFixed(2)}</span>
      </div>
      {onApply && (
        <button
          type="button"
          onClick={() => onApply(quote.milestones.map((milestone) => milestone.amount))}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Apply to proposal
        </button>
      )}
    </section>
  );
}
