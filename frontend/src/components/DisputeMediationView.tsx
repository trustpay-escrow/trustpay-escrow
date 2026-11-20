'use client';

import React, { useState } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { resolveDisputeOnChain, DEFAULT_ARBITER_ADDRESS } from '@/lib/soroban';
import { ImageLightboxModal } from '@/components/ImageLightboxModal';
import { toast } from 'sonner';

export type DisputeStage = 'raised' | 'statement' | 'counter_evidence' | 'arbiter_review' | 'resolved';

export interface TimelineEvent {
  id: string;
  stage: DisputeStage;
  title: string;
  author: string;
  role: 'Client' | 'Freelancer' | 'Arbiter' | 'System';
  timestamp: string;
  description: string;
  attachments?: { name: string; url: string; type: 'image' | 'pdf' }[];
}

export interface DisputeDetails {
  id: string;
  projectId: string;
  projectTitle: string;
  status: 'Open' | 'Under Review' | 'Resolved';
  totalEscrowAmount: number;
  token: string;
  clientAddress: string;
  freelancerAddress: string;
  arbiterAddress: string;
  currentStage: DisputeStage;
  scopeSummary: string;
  deliveredSummary: string;
  privateArbiterNotes?: string;
  events: TimelineEvent[];
}

const mockDefaultDispute: DisputeDetails = {
  id: 'disp-84920',
  projectId: '104',
  projectTitle: 'Smart Contract Audit & Indexer Microservice',
  status: 'Under Review',
  totalEscrowAmount: 3500,
  token: 'USDC',
  clientAddress: 'GB7N...CLIENT',
  freelancerAddress: 'GD82...FREELANCER',
  arbiterAddress: DEFAULT_ARBITER_ADDRESS,
  currentStage: 'arbiter_review',
  scopeSummary:
    'Deliver audited Soroban smart contracts, complete integration test suite with >90% code coverage, and Dockerized indexing microservice with real-time websocket subscriptions.',
  deliveredSummary:
    'Freelancer submitted smart contract code and partial tests (74% coverage). Docker indexing microservice was delivered 4 days late and lacks websocket push notifications.',
  privateArbiterNotes:
    'CONFIDENTIAL NOTE (Arbiter-Eyes-Only): The core escrow logic is secure and well-written. The missing websocket streaming constitutes ~20% of work. Proposed fair ruling: 75% Payout to Freelancer (2,625 USDC) and 25% Refund to Client (875 USDC).',
  events: [
    {
      id: 'ev-1',
      stage: 'raised',
      title: 'Dispute Raised by Client',
      author: 'GB7N...CLIENT',
      role: 'Client',
      timestamp: '2026-11-15 14:22 UTC',
      description:
        'Client initiated dispute on Milestone 2 claiming incomplete test suite and missing websocket functionality.',
      attachments: [
        {
          name: 'project_specification_v1.pdf',
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          type: 'pdf',
        },
      ],
    },
    {
      id: 'ev-2',
      stage: 'statement',
      title: 'Formal Statement Filed by Freelancer',
      author: 'GD82...FREELANCER',
      role: 'Freelancer',
      timestamp: '2026-11-16 09:10 UTC',
      description:
        'Smart contract vulnerabilities in external dependencies delayed integration tests. The Docker container provides REST polling endpoints as agreed during interim review.',
      attachments: [
        {
          name: 'test_coverage_report.png',
          url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
          type: 'image',
        },
      ],
    },
    {
      id: 'ev-3',
      stage: 'counter_evidence',
      title: 'Counter-Evidence Submitted by Client',
      author: 'GB7N...CLIENT',
      role: 'Client',
      timestamp: '2026-11-17 11:45 UTC',
      description:
        'Client provided chat logs demonstrating websocket support was explicitly mandated in the initial proposal milestone deliverables.',
      attachments: [
        {
          name: 'discord_agreement_screenshot.png',
          url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
          type: 'image',
        },
      ],
    },
    {
      id: 'ev-4',
      stage: 'arbiter_review',
      title: 'Arbiter Review Commenced',
      author: DEFAULT_ARBITER_ADDRESS,
      role: 'Arbiter',
      timestamp: '2026-11-18 16:00 UTC',
      description:
        'Assigned decentralized arbiter has reviewed code repositories, test reports, and communication timeline.',
    },
  ],
};

interface DisputeMediationViewProps {
  disputeId?: string;
  initialData?: DisputeDetails;
}

export function DisputeMediationView({ disputeId, initialData }: DisputeMediationViewProps) {
  const { address } = useWalletStore();
  const dispute = initialData || mockDefaultDispute;

  const [activeMedia, setActiveMedia] = useState<{ url: string; name: string; isPdf: boolean } | null>(null);
  const [clientRefund, setClientRefund] = useState<number>(dispute.totalEscrowAmount * 0.25);
  const [freelancerPayout, setFreelancerPayout] = useState<number>(dispute.totalEscrowAmount * 0.75);
  const [resolving, setResolving] = useState<boolean>(false);
  const [isResolved, setIsResolved] = useState<boolean>(dispute.status === 'Resolved');

  // Arbiter access control
  const isAssignedArbiter =
    address &&
    (address.toLowerCase() === dispute.arbiterAddress.toLowerCase() ||
      address.toLowerCase() === DEFAULT_ARBITER_ADDRESS.toLowerCase());

  const stages: { stage: DisputeStage; label: string; number: number }[] = [
    { stage: 'raised', label: 'Dispute Raised', number: 1 },
    { stage: 'statement', label: 'Statement Filed', number: 2 },
    { stage: 'counter_evidence', label: 'Counter-Evidence', number: 3 },
    { stage: 'arbiter_review', label: 'Arbiter Review', number: 4 },
  ];

  const handleExecuteRuling = async () => {
    if (!isAssignedArbiter) {
      toast.error('Unauthorized: Only the assigned arbiter can execute dispute resolution.');
      return;
    }

    if (clientRefund + freelancerPayout > dispute.totalEscrowAmount) {
      toast.error(
        `Total split (${clientRefund + freelancerPayout}) cannot exceed escrow balance (${dispute.totalEscrowAmount} ${dispute.token}).`
      );
      return;
    }

    setResolving(true);
    try {
      await resolveDisputeOnChain({
        arbiterAddress: address!,
        projectIdOnChain: dispute.projectId,
        clientAmount: clientRefund,
        freelancerAmount: freelancerPayout,
      });

      setIsResolved(true);
      toast.success(
        `Dispute successfully settled on-chain! Released ${freelancerPayout} ${dispute.token} to Freelancer, ${clientRefund} ${dispute.token} to Client.`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit dispute settlement transaction');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Lightbox for Document/Image Inspection */}
      {activeMedia && (
        <ImageLightboxModal
          imageUrl={activeMedia.url}
          imageAlt={activeMedia.name}
          isPdf={activeMedia.isPdf}
          onClose={() => setActiveMedia(null)}
        />
      )}

      {/* Header Banner */}
      <div className="bg-[#121215] border border-[#27272a] rounded-3xl p-6 sm:p-8 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Dispute #{dispute.id}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                isResolved
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}
            >
              {isResolved ? 'Resolved' : dispute.status}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {dispute.projectTitle}
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1 font-mono">
            Project ID: #{dispute.projectId} • Escrow Value: {dispute.totalEscrowAmount} {dispute.token}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="px-4 py-2.5 rounded-2xl bg-[#18181c] border border-[#27272a] text-right">
            <span className="text-[10px] text-[#71717a] uppercase font-bold block">
              Designated Arbiter
            </span>
            <span className="text-xs font-mono text-blue-400 truncate max-w-[200px] block">
              {dispute.arbiterAddress.slice(0, 8)}...{dispute.arbiterAddress.slice(-6)}
            </span>
          </div>
        </div>
      </div>

      {/* Structured Mediation Stepper */}
      <div className="bg-[#121215] border border-[#27272a] rounded-3xl p-6 backdrop-blur-xl">
        <h2 className="text-xs font-bold text-[#a1a1aa] uppercase tracking-wider mb-6">
          Mediation Progression Stepper
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stages.map((st) => {
            const isDone = st.stage !== dispute.currentStage || isResolved;
            const isCurrent = st.stage === dispute.currentStage && !isResolved;
            return (
              <div
                key={st.stage}
                className={`p-4 rounded-2xl border transition-all ${
                  isCurrent
                    ? 'bg-blue-600/15 border-blue-500 shadow-md ring-1 ring-blue-500'
                    : isDone
                    ? 'bg-[#18181d] border-emerald-500/40'
                    : 'bg-[#141418] border-[#27272a] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase text-[#71717a]">
                    Phase {st.number}
                  </span>
                  {isDone ? (
                    <span className="text-emerald-400 text-xs font-bold">✓ Complete</span>
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  ) : null}
                </div>
                <div className="text-sm font-bold text-white">{st.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Comparison: Scope vs Delivered Artifacts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Scope */}
        <div className="bg-[#121215] border border-[#27272a] rounded-3xl p-6 backdrop-blur-xl space-y-4">
          <div className="flex items-center space-x-2">
            <span className="text-lg">📋</span>
            <h3 className="text-base font-bold text-white">Original Project Scope</h3>
          </div>
          <p className="text-xs sm:text-sm text-[#d4d4d8] leading-relaxed bg-[#18181c] p-4 rounded-2xl border border-[#27272a]">
            {dispute.scopeSummary}
          </p>
          <div className="flex items-center space-x-2 text-xs text-[#a1a1aa]">
            <span className="font-semibold text-white">Client:</span>
            <span className="font-mono">{dispute.clientAddress}</span>
          </div>
        </div>

        {/* Right Column: Delivered Artifacts */}
        <div className="bg-[#121215] border border-[#27272a] rounded-3xl p-6 backdrop-blur-xl space-y-4">
          <div className="flex items-center space-x-2">
            <span className="text-lg">📦</span>
            <h3 className="text-base font-bold text-white">Delivered Artifacts & Submissions</h3>
          </div>
          <p className="text-xs sm:text-sm text-[#d4d4d8] leading-relaxed bg-[#18181c] p-4 rounded-2xl border border-[#27272a]">
            {dispute.deliveredSummary}
          </p>
          <div className="flex items-center space-x-2 text-xs text-[#a1a1aa]">
            <span className="font-semibold text-white">Freelancer:</span>
            <span className="font-mono">{dispute.freelancerAddress}</span>
          </div>
        </div>
      </div>

      {/* Two-Column Chronological Argument Timeline with Evidence Inspection */}
      <div className="bg-[#121215] border border-[#27272a] rounded-3xl p-6 sm:p-8 backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div>
            <h3 className="text-lg font-bold text-white">Structured Argument Timeline</h3>
            <p className="text-xs text-[#a1a1aa]">
              Chronological log of claims, counter-claims, and proof attachments.
            </p>
          </div>
          <span className="text-xs text-[#71717a]">{dispute.events.length} events logged</span>
        </div>

        <div className="relative border-l-2 border-[#27272a] ml-4 sm:ml-6 space-y-8 pl-6 sm:pl-8">
          {dispute.events.map((ev, index) => {
            const roleBadgeColor =
              ev.role === 'Client'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : ev.role === 'Freelancer'
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                : ev.role === 'Arbiter'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700';

            return (
              <div key={ev.id} className="relative group">
                {/* Timeline node dot */}
                <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-[#18181c] border-2 border-blue-500 group-hover:scale-125 transition-transform" />

                <div className="bg-[#18181c] border border-[#27272a] rounded-2xl p-5 space-y-3 hover:border-[#3f3f46] transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleBadgeColor}`}>
                        {ev.role}
                      </span>
                      <h4 className="text-sm font-bold text-white">{ev.title}</h4>
                    </div>
                    <span className="text-[11px] text-[#71717a] font-mono">{ev.timestamp}</span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                    {ev.description}
                  </p>

                  {/* Evidence Attachments Inspection */}
                  {ev.attachments && ev.attachments.length > 0 && (
                    <div className="pt-2 border-t border-[#27272a]/60">
                      <span className="text-[11px] font-bold text-[#71717a] block mb-2 uppercase tracking-wider">
                        Attached Proof & Evidence:
                      </span>
                      <div className="flex flex-wrap gap-2.5">
                        {ev.attachments.map((att, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() =>
                              setActiveMedia({
                                url: att.url,
                                name: att.name,
                                isPdf: att.type === 'pdf',
                              })
                            }
                            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#232328] hover:bg-[#2d2d34] border border-[#333338] text-xs font-semibold text-blue-400 hover:text-blue-300 transition-all shadow-sm"
                          >
                            <span>{att.type === 'pdf' ? '📄' : '🖼️'}</span>
                            <span className="truncate max-w-[200px]">{att.name}</span>
                            <span className="text-[10px] text-[#71717a]">🔍 Inspect</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Private Arbiter Notes (Restricted via Access Control) */}
      {isAssignedArbiter ? (
        <div className="bg-[#1a1625] border border-amber-600/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl space-y-3">
          <div className="flex items-center space-x-2.5">
            <span className="text-lg">🔒</span>
            <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
              Arbiter Confidential Work Notes (Authorized Access Only)
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#e4e4e7] leading-relaxed bg-[#120f1c] p-4 rounded-2xl border border-amber-500/20 font-mono">
            {dispute.privateArbiterNotes}
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-[#141418] border border-[#27272a] text-center text-xs text-[#71717a]">
          🔒 Private arbiter mediation deliberations are restricted to the assigned arbiter.
        </div>
      )}

      {/* Arbiter Settlement Execution Controls */}
      <div className="bg-[#121215] border border-[#27272a] rounded-3xl p-6 sm:p-8 backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Arbiter Settlement Execution Controls</h3>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Execute final on-chain Soroban distribution between client and contractor.
            </p>
          </div>
          <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            Pool: {dispute.totalEscrowAmount} {dispute.token}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#d4d4d8] uppercase tracking-wider">
              Client Refund Amount ({dispute.token})
            </label>
            <input
              type="number"
              min="0"
              max={dispute.totalEscrowAmount}
              value={clientRefund}
              disabled={!isAssignedArbiter || isResolved}
              onChange={(e) => {
                const val = Number(e.target.value);
                setClientRefund(val);
                setFreelancerPayout(Math.max(0, dispute.totalEscrowAmount - val));
              }}
              className="w-full px-4 py-3 rounded-xl bg-[#18181c] border border-[#27272a] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#d4d4d8] uppercase tracking-wider">
              Freelancer Payout Amount ({dispute.token})
            </label>
            <input
              type="number"
              min="0"
              max={dispute.totalEscrowAmount}
              value={freelancerPayout}
              disabled={!isAssignedArbiter || isResolved}
              onChange={(e) => {
                const val = Number(e.target.value);
                setFreelancerPayout(val);
                setClientRefund(Math.max(0, dispute.totalEscrowAmount - val));
              }}
              className="w-full px-4 py-3 rounded-xl bg-[#18181c] border border-[#27272a] text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#27272a]">
          <div className="text-xs text-[#a1a1aa]">
            {!isAssignedArbiter && (
              <span className="text-amber-400">
                ⚠️ Connect with assigned arbiter wallet ({dispute.arbiterAddress.slice(0, 8)}...) to execute.
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!isAssignedArbiter || resolving || isResolved}
            onClick={handleExecuteRuling}
            className={`px-8 py-3 rounded-xl font-bold text-xs text-white transition-all shadow-xl ${
              !isAssignedArbiter || resolving || isResolved
                ? 'bg-blue-600/30 cursor-not-allowed text-[#71717a]'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30 hover:scale-[1.02]'
            }`}
          >
            {resolving
              ? 'Broadcasting Verdict On-Chain...'
              : isResolved
              ? 'Dispute Ruling Finalized ✓'
              : 'Execute Settlement Ruling ⚖️'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DisputeMediationView;
