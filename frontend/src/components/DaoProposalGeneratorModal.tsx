'use client';

import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { DaoProposalInput } from '@/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useRovingTabIndex } from '@/hooks/useRovingTabIndex';
import {
  buildDaoCalldataJson,
  buildDaoInvocation,
  buildDaoProposalMarkdown,
  MAX_VOTING_DAYS,
  MIN_VOTING_DAYS,
  totalAmount,
  validateDaoProposalInput,
} from '@/lib/dao-proposal';

type OutputTab = 'markdown' | 'calldata';

export interface DaoProposalGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Escrow terms taken from the project being created. */
  defaults: Omit<DaoProposalInput, 'treasuryAddress' | 'votingPeriodDays' | 'proposalTitle'> &
    Partial<Pick<DaoProposalInput, 'treasuryAddress' | 'votingPeriodDays' | 'proposalTitle'>>;
}

const inputClass =
  'w-full bg-[#232326] border border-[#333338] rounded-lg px-3 py-2 text-sm text-white placeholder-[#71717a] focus:outline-none focus:border-blue-500';

/**
 * The dialog's state lives in an inner component that only exists while open,
 * so every opening seeds its fields from the current `defaults` instead of
 * whatever they were when the (always-mounted) parent first rendered.
 */
export function DaoProposalGeneratorModal({ isOpen, onClose, defaults }: DaoProposalGeneratorModalProps) {
  if (!isOpen) return null;
  return <DaoProposalDialog onClose={onClose} defaults={defaults} />;
}

function DaoProposalDialog({ onClose, defaults }: Omit<DaoProposalGeneratorModalProps, 'isOpen'>) {
  const [proposalTitle, setProposalTitle] = useState(
    defaults.proposalTitle ?? `Fund escrow: ${defaults.projectTitle}`.trim()
  );
  const [treasuryAddress, setTreasuryAddress] = useState(defaults.treasuryAddress ?? '');
  const [freelancerAddress, setFreelancerAddress] = useState(defaults.freelancerAddress ?? '');
  const [arbiterAddress, setArbiterAddress] = useState(defaults.arbiterAddress ?? '');
  const [votingPeriodDays, setVotingPeriodDays] = useState(defaults.votingPeriodDays ?? 7);
  const [tab, setTab] = useState<OutputTab>('markdown');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, {
    isOpen: true,
    onClose,
  });

  const outputTabs: Array<[OutputTab, string]> = [
    ['markdown', 'Forum markdown'],
    ['calldata', 'Soroban calldata'],
  ];
  const { getItemProps: getTabProps } = useRovingTabIndex({
    count: outputTabs.length,
    activeIndex: tab === 'markdown' ? 0 : 1,
    onSelect: (index) => setTab(outputTabs[index][0]),
    orientation: 'horizontal',
  });

  const input: DaoProposalInput = useMemo(
    () => ({
      ...defaults,
      proposalTitle,
      treasuryAddress,
      freelancerAddress,
      arbiterAddress,
      votingPeriodDays,
    }),
    [defaults, proposalTitle, treasuryAddress, freelancerAddress, arbiterAddress, votingPeriodDays]
  );

  const errors = useMemo(() => validateDaoProposalInput(input), [input]);
  const valid = Object.keys(errors).length === 0;

  const outputs = useMemo(() => {
    if (!valid) return null;
    const invocation = buildDaoInvocation(input);
    return {
      markdown: buildDaoProposalMarkdown(input, invocation),
      calldata: buildDaoCalldataJson(input, invocation),
    };
  }, [valid, input]);

  const active = outputs?.[tab] ?? '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active);
      toast.success(tab === 'markdown' ? 'Proposal markdown copied' : 'Calldata copied');
    } catch {
      toast.error('Could not access the clipboard. Select the text and copy it manually.');
    }
  };

  const download = () => {
    const blob = new Blob([active], { type: tab === 'markdown' ? 'text/markdown' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tab === 'markdown' ? 'dao-escrow-proposal.md' : 'dao-escrow-calldata.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const fieldError = (key: keyof typeof errors) =>
    errors[key] ? (
      <p role="alert" className="text-xs text-red-400 mt-1">
        {errors[key]}
      </p>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="DAO proposal generator"
        tabIndex={-1}
        className="bg-[#18181b] border border-[#27272a] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-[#27272a] bg-[#1c1c20] flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">DAO Proposal Generator</h2>
            <p className="text-xs text-[#71717a] mt-1">
              Turn these escrow terms into a governance post and executable Soroban calldata.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close DAO proposal generator"
            className="text-[#a1a1aa] hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="dao-title" className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Proposal title
              </label>
              <input id="dao-title" className={inputClass} value={proposalTitle} onChange={(e) => setProposalTitle(e.target.value)} />
              {fieldError('proposalTitle')}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="dao-treasury" className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                DAO treasury address (funds and authorises the escrow)
              </label>
              <input
                id="dao-treasury"
                className={`${inputClass} font-mono`}
                placeholder="G… or C…"
                value={treasuryAddress}
                onChange={(e) => setTreasuryAddress(e.target.value)}
              />
              {fieldError('treasuryAddress')}
            </div>
            <div>
              <label htmlFor="dao-freelancer" className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Freelancer address (optional)
              </label>
              <input
                id="dao-freelancer"
                className={`${inputClass} font-mono`}
                placeholder="G…"
                value={freelancerAddress}
                onChange={(e) => setFreelancerAddress(e.target.value)}
              />
              {fieldError('freelancerAddress')}
            </div>
            <div>
              <label htmlFor="dao-arbiter" className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Arbiter address (optional, defaults to platform arbiter)
              </label>
              <input
                id="dao-arbiter"
                className={`${inputClass} font-mono`}
                placeholder="G…"
                value={arbiterAddress}
                onChange={(e) => setArbiterAddress(e.target.value)}
              />
              {fieldError('arbiterAddress')}
            </div>
            <div>
              <label htmlFor="dao-voting" className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Voting period (days)
              </label>
              <input
                id="dao-voting"
                type="number"
                min={MIN_VOTING_DAYS}
                max={MAX_VOTING_DAYS}
                className={inputClass}
                value={votingPeriodDays}
                onChange={(e) => setVotingPeriodDays(Number(e.target.value))}
              />
              {fieldError('votingPeriodDays')}
            </div>
            <div className="flex items-end">
              <p className="text-sm text-[#a1a1aa]">
                Total:{' '}
                <span className="font-mono text-white">
                  {totalAmount(input).toLocaleString('en-US', { maximumFractionDigits: 7 })} {defaults.token}
                </span>{' '}
                across {defaults.milestones.length} milestone{defaults.milestones.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          {fieldError('milestones')}
          {fieldError('tokenAddress')}

          {outputs ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div role="tablist" aria-label="Proposal output" className="inline-flex rounded-lg border border-[#27272a] overflow-hidden">
                  {outputTabs.map(([id, label], index) => {
                    const tabProps = getTabProps(index);
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        ref={tabProps.ref}
                        tabIndex={tabProps.tabIndex}
                        onKeyDown={tabProps.onKeyDown}
                        onClick={() => setTab(id)}
                        className={`px-3 py-1.5 text-xs font-semibold ${
                          tab === id ? 'bg-blue-600 text-white' : 'bg-[#18181b] text-[#a1a1aa] hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copy}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                  >
                    {tab === 'markdown' ? 'Copy Markdown' : 'Copy Calldata'}
                  </button>
                  <button
                    type="button"
                    onClick={download}
                    className="px-3 py-1.5 rounded-lg bg-[#232326] hover:bg-[#2c2c30] border border-[#333338] text-white text-xs font-bold"
                  >
                    Download
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                aria-label={tab === 'markdown' ? 'Proposal markdown' : 'Soroban calldata'}
                value={active}
                rows={16}
                className="w-full bg-[#0f0f11] border border-[#27272a] rounded-lg p-3 text-xs font-mono text-[#e4e4e7] resize-y"
              />
            </div>
          ) : (
            <p className="text-sm text-[#a1a1aa]">Fix the highlighted fields to generate the proposal.</p>
          )}
        </div>
      </div>
    </div>
  );
}
