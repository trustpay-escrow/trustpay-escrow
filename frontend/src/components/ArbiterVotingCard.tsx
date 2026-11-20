'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { getStellarExplorerUrl } from '@/lib/soroban';
import type { Project } from '@/types';
import type { CastVote } from '@/hooks/useArbitration';

export interface ArbiterVotingCardProps {
  project: Project;
  vote?: CastVote;
  quorumSize: number;
  requiredVotes: number;
  votesCast: number;
  onVote: (clientPct: number) => void;
  voting: boolean;
}

export function ArbiterVotingCard({
  project,
  vote,
  quorumSize,
  requiredVotes,
  votesCast,
  onVote,
  voting,
}: ArbiterVotingCardProps) {
  const [clientPct, setClientPct] = useState(vote?.clientPct ?? 50);
  const budget = Number(project.budget) || 0;
  const token = project.token || 'USDC';
  const voted = Boolean(vote);

  const handleVote = () => {
    if (clientPct < 0 || clientPct > 100) {
      toast.error('Split must be between 0% and 100%.');
      return;
    }
    onVote(clientPct);
  };

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{project.title}</h3>
          <p className="text-[11px] text-[#71717a] mt-0.5">
            Project #{project.project_id_onchain?.toString() ?? project.id} · {budget} {token} in escrow
          </p>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30">
          Disputed
        </span>
      </div>

      {/* Quorum progress */}
      <div>
        <div className="flex justify-between text-[10px] font-bold text-[#a1a1aa] mb-1.5">
          <span>
            {votesCast} of {quorumSize} arbiters voted
          </span>
          <span className={votesCast >= requiredVotes ? 'text-emerald-400' : 'text-amber-400'}>
            {votesCast >= requiredVotes ? 'Consensus reached' : `${requiredVotes} needed to settle`}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#27272a] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${votesCast >= requiredVotes ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${Math.min(100, (votesCast / quorumSize) * 100)}%` }}
          />
        </div>
      </div>

      {/* Secret ballot */}
      <div className="space-y-3">
        <div className="flex justify-between text-[11px] font-bold">
          <span className="text-slate-300">Client refund</span>
          <span className="text-indigo-300 font-mono">{clientPct}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={clientPct}
          disabled={voted || voting}
          onChange={(e) => setClientPct(Number(e.target.value))}
          className="w-full accent-indigo-500 disabled:opacity-40"
          aria-label="Client settlement percentage"
        />
        <div className="flex justify-between text-[11px] font-bold">
          <span className="text-slate-300">Freelancer payout</span>
          <span className="text-emerald-300 font-mono">{100 - clientPct}%</span>
        </div>
        <p className="text-[10px] text-[#71717a]">
          ≈ {(budget * (clientPct / 100)).toFixed(2)} {token} → client · {(budget * ((100 - clientPct) / 100)).toFixed(2)} {token} → freelancer
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="text-[10px] text-[#71717a]">
          {voted ? (
            <span className="text-emerald-400 font-semibold">
              ✓ Ballot cast ({vote!.clientPct}% / {vote!.freelancerPct}%)
              {vote!.resolved ? ' — dispute settled' : ' — awaiting quorum'}
              {vote!.txHash && (
                <>
                  {' · '}
                  <a
                    href={getStellarExplorerUrl(vote!.txHash, 'tx')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    tx ↗
                  </a>
                </>
              )}
            </span>
          ) : (
            'Votes are secret until quorum is reached.'
          )}
        </div>
        <button
          type="button"
          onClick={handleVote}
          disabled={voted || voting}
          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-[#27272a] disabled:text-[#52525b] text-white text-xs font-bold transition-all"
        >
          {voting ? 'Signing…' : voted ? 'Voted' : 'Cast Vote'}
        </button>
      </div>
    </div>
  );
}
