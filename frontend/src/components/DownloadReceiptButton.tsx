'use client';

import React, { useId, useState } from 'react';
import { toast } from 'sonner';
import { Milestone, Project, Proposal } from '@/types';
import {
  downloadReceiptPdf,
  SettlementReceiptData,
  calculateReceiptTotals,
} from '@/lib/receipt-generator';
import { getStellarExplorerUrl } from '@/lib/soroban';
import { AccessibleModal } from '@/components/a11y/AccessibleModal';

export interface DownloadReceiptButtonProps {
  project: Project;
  milestone?: Milestone;
  proposal?: Proposal;
  ledger?: number | string;
  label?: string;
  className?: string;
}

export function DownloadReceiptButton({
  project,
  milestone,
  proposal,
  ledger,
  label = 'Download Receipt',
  className = '',
}: DownloadReceiptButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [businessName, setBusinessName] = useState('TrustPay Escrow');
  const [notes, setNotes] = useState('');
  const [vatRate, setVatRate] = useState('0');
  const titleId = useId();

  const resolvedMilestone =
    milestone || project.milestones?.find((item) => item.status === 'approved') || project.milestones?.[0];
  const token = project.token || 'USDC';
  const amount = resolvedMilestone?.amount ?? proposal?.budget ?? project.budget ?? 0;
  const numericVatRate = Number(vatRate);
  const totals = calculateReceiptTotals({
    projectTitle: project.title,
    milestoneTitle: resolvedMilestone?.title || 'Milestone Settlement',
    amount,
    token,
    vatRate: Number.isFinite(numericVatRate) ? numericVatRate : 0,
  });

  const buildReceiptData = (): SettlementReceiptData => {
    const txHash = project.tx_hash;
    const verificationId = txHash || project.contract_id || project.id;
    const explorerUrl = getStellarExplorerUrl(verificationId, txHash ? 'tx' : 'contract');

    return {
      projectTitle: project.title,
      milestoneTitle: resolvedMilestone?.title || 'Milestone Settlement',
      milestoneIndex: resolvedMilestone?.milestone_index,
      amount,
      token,
      clientAddress: project.client_address,
      freelancerAddress: project.freelancer_address || proposal?.freelancer_address || proposal?.stellar_address,
      txHash,
      ledger,
      closedAt:
        resolvedMilestone?.auto_release_at ||
        resolvedMilestone?.submitted_at ||
        project.deadline ||
        project.created_at ||
        new Date().toISOString(),
      usdAmount: token === 'XLM' ? undefined : amount,
      vatRate: Number.isFinite(numericVatRate) ? numericVatRate : 0,
      businessName,
      notes,
      explorerUrl,
    };
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await downloadReceiptPdf(buildReceiptData());
      toast.success('Settlement receipt downloaded as PDF');
      setIsOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate the receipt');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="download-receipt-button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 ${className}`}
      >
        <span aria-hidden="true">🧾</span>
        {label}
      </button>

      <AccessibleModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        ariaLabelledBy={titleId}
        backdropClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md"
        dialogClassName="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6"
      >
        <div>
          <h3 id={titleId} className="text-lg font-bold text-white">Customize settlement receipt</h3>
          <p className="mt-1 text-xs text-slate-400">
            {project.title} — {resolvedMilestone?.title || 'Milestone Settlement'}
          </p>
        </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300" htmlFor="receipt-business-name">
                Business legal name
              </label>
              <input
                id="receipt-business-name"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Your registered business name"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300" htmlFor="receipt-vat-rate">
                VAT / Tax rate (%)
              </label>
              <input
                id="receipt-vat-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={vatRate}
                onChange={(event) => setVatRate(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300" htmlFor="receipt-notes">
                Invoice notes
              </label>
              <textarea
                id="receipt-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Payment terms, tax registration, or referencing details"
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Net amount</span>
                <span className="font-mono">{totals.subtotal.toLocaleString()} {token}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Tax</span>
                <span className="font-mono">{totals.taxAmount.toLocaleString()} {token}</span>
              </div>
              <div className="mt-1 flex justify-between font-bold text-white">
                <span>Total</span>
                <span className="font-mono">{totals.total.toLocaleString()} {token}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-receipt-download"
                disabled={isGenerating}
                onClick={() => void handleDownload()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Generate & Download'}
              </button>
            </div>
      </AccessibleModal>
    </>
  );
}

export default DownloadReceiptButton;
