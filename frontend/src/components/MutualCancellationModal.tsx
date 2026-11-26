'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AccessibleModal } from '@/components/a11y/AccessibleModal';
import { announcePolite } from '@/components/a11y/LiveAnnouncer';
import { Project } from '@/types';
import { useWalletStore } from '@/store/walletStore';
import { authFetch } from '@/lib/api';
import {
  mutualCancelOnChain,
  getStellarExplorerUrl,
  DEFAULT_ESCROW_CONTRACT_ID,
  TxStage,
} from '@/lib/soroban';
import { CryptoId } from '@/components/ui/CryptoId';

export interface MutualCancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onUpdated?: () => void;
}

/** Platform service fee released to the treasury on mutual cancellation. */
const PLATFORM_FEE_RATE = 0.025;

interface SettlementProposal {
  clientRefund: number;
  freelancerComp: number;
  proposedBy: string;
  proposedAt: number;
}

function proposalStorageKey(projectId: string) {
  return `mutual-cancel-proposal:${projectId}`;
}

export function MutualCancellationModal({ isOpen, onClose, project, onUpdated }: MutualCancellationModalProps) {
  const { address } = useWalletStore();

  const [refundInput, setRefundInput] = useState<number | ''>('');
  const [compInput, setCompInput] = useState<number | ''>('');
  const [proposal, setProposal] = useState<SettlementProposal | null>(null);
  const [txState, setTxState] = useState<{ stage: TxStage; message: string; txHash?: string; error?: string }>({
    stage: 'preparing',
    message: '',
  });
  const [executing, setExecuting] = useState(false);
  const titleId = useId();
  const refundInputId = useId();
  const compInputId = useId();

  const tokenSymbol = project.token || 'USDC';

  // Remaining locked escrow = budget minus already-released (approved) milestones
  const remainingLocked = useMemo(() => {
    const released = (project.milestones || [])
      .filter((m) => m.status === 'approved')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    return Math.max(0, (Number(project.budget) || 0) - released);
  }, [project]);

  const platformFee = useMemo(
    () => Number((remainingLocked * PLATFORM_FEE_RATE).toFixed(2)),
    [remainingLocked]
  );
  const distributable = useMemo(
    () => Number((remainingLocked - platformFee).toFixed(2)),
    [remainingLocked, platformFee]
  );

  const isClient = Boolean(address && project.client_address && address.toUpperCase() === project.client_address.toUpperCase());
  const isFreelancer = Boolean(address && project.freelancer_address && address.toUpperCase() === project.freelancer_address.toUpperCase());
  const isParty = isClient || isFreelancer;

  useEffect(() => {
    if (!isOpen || !project?.id) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (cancelled) return;
        try {
          const raw = sessionStorage.getItem(proposalStorageKey(project.id));
          setProposal(raw ? JSON.parse(raw) : null);
        } catch {
          setProposal(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, project?.id]);

  const persistProposal = (p: SettlementProposal | null) => {
    setProposal(p);
    try {
      if (p) sessionStorage.setItem(proposalStorageKey(project.id), JSON.stringify(p));
      else sessionStorage.removeItem(proposalStorageKey(project.id));
    } catch {
      // storage unavailable
    }
  };

  if (!isOpen) return null;

  const refundNum = Number(refundInput) || 0;
  const compNum = Number(compInput) || 0;
  const splitValid =
    refundNum >= 0 &&
    compNum >= 0 &&
    refundNum + compNum > 0 &&
    Math.abs(refundNum + compNum - distributable) < 0.01;

  const handlePropose = () => {
    if (!address) {
      toast.error('Please connect your wallet first.');
      return;
    }
    if (!splitValid) {
      toast.error(`Refund + compensation must equal the distributable escrow (${distributable} ${tokenSymbol}).`);
      return;
    }
    persistProposal({
      clientRefund: refundNum,
      freelancerComp: compNum,
      proposedBy: address,
      proposedAt: Date.now(),
    });
    announcePolite('Settlement proposal created and awaiting counterparty acceptance.');
    toast.success('Settlement proposal created — awaiting counterparty acceptance.');
  };

  const handleReject = () => {
    persistProposal(null);
    announcePolite('Settlement proposal rejected.');
    toast.info('Settlement proposal rejected.');
  };

  const handleAccept = async () => {
    if (!proposal) return;
    if (!address) {
      toast.error('Please connect the counterparty wallet first.');
      return;
    }
    if (!project.project_id_onchain) {
      toast.error('Project has no on-chain escrow to cancel.');
      return;
    }

    setExecuting(true);
    setTxState({ stage: 'preparing', message: 'Executing mutual_cancel on Soroban contract...' });
    try {
      const res = await mutualCancelOnChain({
        callerAddress: address,
        projectIdOnChain: project.project_id_onchain,
        clientRefundAmount: proposal.clientRefund,
        freelancerCompensation: proposal.freelancerComp,
        contractAddress: project.contract_id || DEFAULT_ESCROW_CONTRACT_ID,
        onStatusUpdate: (stage, message) => {
          setTxState((prev) => ({ ...prev, stage, message }));
          announcePolite(message);
        },
      });

      setTxState((prev) => ({
        ...prev,
        stage: 'success',
        txHash: res.txHash,
        message: 'Mutual cancellation executed — escrow split disbursed.',
      }));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await authFetch(`${apiUrl}/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      persistProposal(null);
      toast.success('Mutual cancellation completed on-chain!');
      onUpdated?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTxState((prev) => ({ ...prev, stage: 'error', error: message }));
      toast.error(`Mutual cancellation failed: ${message}`);
    } finally {
      setExecuting(false);
    }
  };

  const isAwaitingCounterparty = Boolean(
    proposal && address && proposal.proposedBy.toUpperCase() !== address.toUpperCase()
  );
  const isOwnProposal = Boolean(proposal && address && proposal.proposedBy.toUpperCase() === address.toUpperCase());

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={executing ? undefined : onClose}
      ariaLabelledBy={titleId}
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      dialogClassName="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
    >
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Amicable Exit</span>
        <h3 id={titleId} className="text-xl font-bold text-white mt-1">Mutual Cancellation & Refund Split</h3>
        <p className="text-xs text-slate-400 mt-1">
          Settle remaining locked escrow without arbitration. Both parties must agree before{' '}
          <code className="text-amber-300">mutual_cancel</code> executes on-chain.
        </p>
      </div>

        {/* Remaining escrow breakdown */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>Remaining Locked Escrow:</span>
            <span className="font-bold text-white">{remainingLocked} {tokenSymbol}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Platform Service Fee ({(PLATFORM_FEE_RATE * 100).toFixed(1)}%):</span>
            <span className="font-bold text-amber-400">{platformFee} {tokenSymbol}</span>
          </div>
          <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-1.5">
            <span>Distributable to Parties:</span>
            <span className="font-bold text-indigo-400">{distributable} {tokenSymbol}</span>
          </div>
        </div>

        {/* Compose / awaiting / result states */}
        {!proposal ? (
          <div className="space-y-4 text-xs">
            <div>
              <label htmlFor={refundInputId} className="block text-slate-300 font-semibold mb-1.5">
                Refund to Client ({tokenSymbol})
              </label>
              <input
                id={refundInputId}
                type="number"
                min={0}
                value={refundInput}
                onChange={(e) => setRefundInput(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Amount returned to client"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label htmlFor={compInputId} className="block text-slate-300 font-semibold mb-1.5">
                Compensate Freelancer ({tokenSymbol})
              </label>
              <input
                id={compInputId}
                type="number"
                min={0}
                value={compInput}
                onChange={(e) => setCompInput(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Amount paid to freelancer"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Proposed split total:</span>
                <span className={splitValid ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {refundNum + compNum} / {distributable} {tokenSymbol}
                </span>
              </div>
              {!splitValid && (
                <p className="text-amber-300/80">
                  Split must equal the distributable escrow amount after the platform fee.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Proposed by:</span>
              <CryptoId value={proposal.proposedBy} head={6} tail={4} className="text-slate-400" />
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Refund to Client:</span>
              <span className="font-bold text-white">{proposal.clientRefund} {tokenSymbol}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Compensate Freelancer:</span>
              <span className="font-bold text-white">{proposal.freelancerComp} {tokenSymbol}</span>
            </div>
            <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-1.5">
              <span>Platform Fee Released:</span>
              <span className="font-bold text-amber-400">{platformFee} {tokenSymbol}</span>
            </div>
          </div>
        )}

        {/* Action footer */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div>
            {!isParty && address && (
              <p className="text-[11px] text-amber-300">Only the client or freelancer can respond.</p>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
            >
              Close
            </Button>

            {!proposal && isParty && (
              <Button
                onClick={handlePropose}
                disabled={!splitValid}
                className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold px-5 disabled:opacity-40"
              >
                Propose Settlement
              </Button>
            )}

            {proposal && (isOwnProposal || !isParty) && (
              <>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-xl text-xs"
                >
                  {isOwnProposal ? 'Withdraw Proposal' : 'Reject Proposal'}
                </Button>
                <span className="text-[11px] text-slate-500 italic">Awaiting counterparty…</span>
              </>
            )}

            {proposal && isAwaitingCounterparty && isParty && (
              <>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={executing}
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-xl text-xs"
                >
                  Reject Proposal
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={executing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold px-5"
                >
                  {executing ? 'Executing…' : 'Accept Settlement ↗'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tx progress */}
        <div role="status" aria-live="polite" aria-atomic="true">
          {executing && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span className="capitalize">{txState.stage}: {txState.message || txState.error}</span>
            </div>
          )}
        </div>
        {txState.stage === 'success' && txState.txHash && (
          <a
            href={getStellarExplorerUrl(txState.txHash, 'tx')}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[11px] text-indigo-400 hover:text-indigo-300 underline text-center"
          >
            View transaction on Stellar.Expert ↗
          </a>
        )}
    </AccessibleModal>
  );
}
