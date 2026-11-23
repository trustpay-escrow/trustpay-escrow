'use client';

import React from 'react';
import Link from 'next/link';
import { useWalletStore } from '@/store/walletStore';
import { useArbitration } from '@/hooks/useArbitration';
import { ArbiterVotingCard } from '@/components/ArbiterVotingCard';
import { CryptoId } from '@/components/ui/CryptoId';
import type { TxStage } from '@/lib/soroban';

const STAGE_LABELS: Record<TxStage | 'idle', string> = {
  idle: '',
  preparing: 'Preparing transaction…',
  simulating: 'Simulating contract call…',
  signing: 'Awaiting wallet signature…',
  submitting: 'Broadcasting to Stellar…',
  polling: 'Confirming on ledger…',
  success: 'Confirmed on Stellar!',
  error: 'Transaction error',
};

export default function ArbiterPortalPage() {
  const { address } = useWalletStore();
  const {
    disputes,
    loading,
    refreshing,
    refresh,
    votes,
    stakingBalance,
    earnedFees,
    txStatus,
    submitVote,
    claimFees,
    quorumSize,
    requiredVotes,
  } = useArbitration();

  const [votingId, setVotingId] = React.useState<string | null>(null);
  const [claiming, setClaiming] = React.useState(false);

  const handleVote = async (projectId: string, clientPct: number) => {
    const project = disputes.find((p) => p.id === projectId);
    if (!project) return;
    setVotingId(projectId);
    try {
      await submitVote(project, clientPct);
    } finally {
      setVotingId(null);
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await claimFees();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Link href="/projects" className="text-xs text-indigo-400 hover:underline">← Back to Projects</Link>
            <h1 className="text-3xl font-extrabold text-white mt-1">Arbiter Governance Portal</h1>
            <p className="text-sm text-slate-400 mt-1">
              Stake, review disputed escrows, and cast consensus settlement votes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl bg-[#18181b] hover:bg-[#27272a] border border-[#333338] text-white text-xs font-bold transition-colors"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">Staking Balance</p>
            <p className="text-2xl font-extrabold text-white mt-1 font-mono">
              {stakingBalance ?? '—'} <span className="text-sm text-slate-400">XLM</span>
            </p>
            {address && <p className="text-[10px] text-[#52525b] mt-1"><CryptoId value={address} head={6} tail={4} /></p>}
          </div>
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">Active Disputes</p>
            <p className="text-2xl font-extrabold text-amber-400 mt-1">{disputes.length}</p>
            <p className="text-[10px] text-[#52525b] mt-1">Assigned to consensus panel</p>
          </div>
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">Earned Fees</p>
              <p className="text-2xl font-extrabold text-emerald-400 mt-1">{earnedFees.toFixed(2)} USDC</p>
            </div>
            <button
              type="button"
              onClick={() => void handleClaim()}
              disabled={claiming || !address}
              className="mt-2 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#27272a] disabled:text-[#52525b] text-white text-xs font-bold transition-all"
            >
              {claiming ? 'Claiming…' : 'Claim Fees'}
            </button>
          </div>
        </div>

        {/* Tx status */}
        {txStatus && (
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3 text-xs text-indigo-300 flex items-center gap-2">
            {txStatus.stage !== 'error' && txStatus.stage !== 'success' && (
              <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
            )}
            {STAGE_LABELS[txStatus.stage] || txStatus.message}
            {txStatus.message && txStatus.stage !== 'idle' ? ` — ${txStatus.message}` : ''}
          </div>
        )}

        {!address && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-sm text-amber-300">
            Connect an arbiter wallet from the <Link href="/" className="underline font-bold">home page</Link> to stake and vote.
          </div>
        )}

        {/* Dispute ballots */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Dispute Assignments</h2>
          {loading ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="h-44 rounded-2xl bg-[#18181b] border border-[#27272a] animate-pulse" />
              ))}
            </div>
          ) : disputes.length === 0 ? (
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-10 text-center">
              <p className="text-sm text-[#a1a1aa]">No active disputes awaiting arbitration.</p>
            </div>
          ) : (
            disputes.map((project) => (
              <ArbiterVotingCard
                key={project.id}
                project={project}
                vote={votes[project.id]}
                quorumSize={quorumSize}
                requiredVotes={requiredVotes}
                votesCast={votes[project.id] ? 1 : 0}
                onVote={(pct) => void handleVote(project.id, pct)}
                voting={votingId === project.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
