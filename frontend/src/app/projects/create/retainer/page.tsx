'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Header from '@/components/Header';
import {
  RetainerAgreementCard,
  RetainerAgreementForm,
} from '@/components/RetainerAgreementCard';
import {
  RETAINER_FREQUENCIES,
  generateRetainerSchedule,
  toRetainerIsoDate,
} from '@/lib/retainer';
import { authFetch } from '@/lib/api';
import { useWalletStore } from '@/store/walletStore';
import { SUPPORTED_TOKENS } from '@/config/tokens';
import type { RetainerConfig } from '@/types';

export default function CreateRetainerPage() {
  const router = useRouter();
  const { address } = useWalletStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<RetainerConfig>({
    frequency: 'monthly',
    cycles: 3,
    amountPerCycle: 0,
    startDate: toRetainerIsoDate(new Date()),
    token: 'USDC',
    status: 'active',
    completedCycles: 0,
  });

  const handleCreate = async (config: RetainerConfig) => {
    if (!address) {
      toast.error('Please connect your client wallet before creating a retainer.');
      return;
    }

    const schedule = generateRetainerSchedule(config);
    if (schedule.entries.length === 0) {
      toast.error('Add at least one funding cycle.');
      return;
    }

    const token = config.token || 'USDC';
    const lastFundingDate = schedule.entries[schedule.entries.length - 1].date;
    const frequencyLabel = RETAINER_FREQUENCIES[config.frequency].label;

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await authFetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Recurring retainer (${frequencyLabel.toLowerCase()})`,
          description: `${frequencyLabel} retainer agreement with ${config.cycles} funding cycle${
            config.cycles === 1 ? '' : 's'
          } of ${config.amountPerCycle} ${token}. Each cycle creates a milestone that must be approved before the next funding date.`,
          category: 'Development',
          budget: schedule.totalObligation,
          token,
          token_address: SUPPORTED_TOKENS[token]?.issuerOrContractAddress,
          deadline: lastFundingDate,
          visibility: 'Private',
          client_address: address,
          status: 'draft',
          retainer_config: {
            ...config,
            token,
            status: 'active',
            completedCycles: 0,
          },
          milestones: schedule.entries.map((entry, index) => ({
            milestone_index: index,
            title: `Retainer cycle ${entry.cycle}`,
            description: `${frequencyLabel} retainer funding for cycle ${entry.cycle}.`,
            amount: entry.amount,
            start_date:
              index === 0 ? config.startDate : schedule.entries[index - 1].date,
            due_date: entry.date,
            deliverable_type: 'Retainer deliverable',
            revision_limit: 0,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create the retainer agreement');
      }

      toast.success('Retainer escrow created with its funding schedule!');
      if (data.project?.id) {
        router.push(`/projects/${data.project.id}`);
      } else {
        router.push('/projects');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the retainer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#09090b] text-[#f4f4f5] selection:bg-indigo-500/30 selection:text-white">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/projects/create"
            className="inline-flex items-center space-x-1 text-xs text-[#a1a1aa] transition-colors hover:text-white"
          >
            <span>← Back to project setup</span>
          </Link>
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
            Recurring escrow
          </span>
        </div>

        <header className="mb-6 max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Retainer billing agreement
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Fund ongoing freelancer work weekly, bi-weekly, or monthly. Each cycle becomes a
            milestone on the escrow, and either party can stop future renewals with a 7-day
            notice.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section aria-label="Retainer setup">
            <RetainerAgreementForm
              isSubmitting={isSubmitting}
              onSubmit={handleCreate}
              onPreviewChange={(next) =>
                setPreview((prev) => ({ ...prev, ...next }))
              }
            />
            <p className="mt-3 text-[11px] text-slate-500">
              The retainer is created as a draft escrow. Approving the first cycle on-chain
              releases that cycle&apos;s funds and enables the next renewal.
            </p>
          </section>

          <section aria-label="Retainer preview" className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Agreement preview
            </h2>
            <RetainerAgreementCard agreement={preview} token={preview.token} />
          </section>
        </div>
      </main>

      <footer className="w-full border-t border-[#27272a] py-6 text-center text-xs text-[#71717a]">
        TrustPay Escrow Protocol • Powered by Stellar Soroban
      </footer>
    </div>
  );
}
