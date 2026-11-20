'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useWalletStore } from '@/store/walletStore';
import { authFetch } from '@/lib/api';
import {
  submitDisputeRulingOnChain,
  claimArbiterFeesOnChain,
  HORIZON_URL,
  type TxStage,
} from '@/lib/soroban';
import type { Project } from '@/types';

export const ARBITER_QUORUM_SIZE = 3;
export const ARBITER_REQUIRED_VOTES = 2;

export interface CastVote {
  projectId: string;
  clientPct: number;
  freelancerPct: number;
  txHash: string;
  resolved: boolean;
}

/**
 * Data hook for the decentralized arbiter portal: lists disputed escrows,
 * submits consensus split votes on-chain, and claims arbitration fees.
 */
export function useArbitration() {
  const { address } = useWalletStore();
  const [disputes, setDisputes] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [votes, setVotes] = useState<Record<string, CastVote>>({});
  const [accountInfo, setAccountInfo] = useState<{ address: string; balance: string } | null>(null);
  const stakingBalance = accountInfo?.address === address ? accountInfo.balance : null;
  const [earnedFees, setEarnedFees] = useState(0);
  const [txStatus, setTxStatus] = useState<{ stage: TxStage | 'idle'; message: string } | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await authFetch(`${apiUrl}/api/projects?limit=100`);
      const data = await res.json();
      const all: Project[] = Array.isArray(data?.projects) ? data.projects : [];
      setDisputes(all.filter((p) => p.status === 'disputed'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load disputes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(initial);
  }, [refresh]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetch(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const native = data?.balances?.find((b: { asset_type?: string; balance?: string }) => b.asset_type === 'native');
        if (native?.balance) setAccountInfo({ address, balance: native.balance });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address]);

  const submitVote = useCallback(
    async (project: Project, clientPct: number) => {
      if (!address) {
        toast.error('Connect your arbiter wallet first.');
        return;
      }
      const freelancerPct = 100 - clientPct;
      const budget = Number(project.budget) || 0;
      const clientAmount = (budget * clientPct) / 100;
      const freelancerAmount = (budget * freelancerPct) / 100;
      const onChainId = project.project_id_onchain ?? project.id ?? 1;

      setTxStatus({ stage: 'preparing', message: `Submitting arbiter vote (${clientPct}% client / ${freelancerPct}% freelancer)...` });
      try {
        const res = await submitDisputeRulingOnChain({
          arbiterAddress: address,
          projectIdOnChain: onChainId,
          clientAmount,
          freelancerAmount,
          onStatusUpdate: (stage, message) => setTxStatus({ stage, message }),
        });

        const resolved = res.returnValue === true;
        setVotes((prev) => ({
          ...prev,
          [project.id]: { projectId: project.id, clientPct, freelancerPct, txHash: res.txHash, resolved },
        }));
        setTxStatus(null);
        if (resolved) {
          toast.success('Consensus reached — dispute settled on-chain!');
          await refresh();
        } else {
          toast.success(`Vote submitted on-chain (tx ${res.txHash.slice(0, 10)}…). Awaiting consensus.`);
        }
      } catch (err: unknown) {
        setTxStatus(null);
        toast.error(`Vote failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [address, refresh]
  );

  const claimFees = useCallback(async () => {
    if (!address) {
      toast.error('Connect your arbiter wallet first.');
      return;
    }
    setTxStatus({ stage: 'preparing', message: 'Withdrawing accumulated arbitration fees...' });
    try {
      const res = await claimArbiterFeesOnChain({
        arbiterAddress: address,
        onStatusUpdate: (stage, message) => setTxStatus({ stage, message }),
      });
      setTxStatus(null);
      setEarnedFees(0);
      toast.success(`Arbitration fees claimed on-chain (tx ${res.txHash.slice(0, 10)}…).`);
    } catch (err: unknown) {
      setTxStatus(null);
      toast.error(`Fee claim failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [address]);

  return {
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
    quorumSize: ARBITER_QUORUM_SIZE,
    requiredVotes: ARBITER_REQUIRED_VOTES,
  };
}
