import { Account, Operation, TransactionBuilder, nativeToScVal, xdr, Address } from '@stellar/stellar-sdk';
import type { Project } from '@/types';
import {
  DEFAULT_ESCROW_CONTRACT_ID,
  DEFAULT_SOROBAN_BASE_FEE,
  STELLAR_NETWORK_PASSPHRASE,
  invokeSorobanBatch,
  type SorobanTxResult,
  type TxStage,
} from '@/lib/soroban';

export interface BulkPayoutMilestone {
  /** Stable selection key: `${projectId}:${milestoneIndex}`. */
  key: string;
  milestoneId: string;
  projectId: string;
  onChainProjectId: number | string | bigint;
  projectTitle: string;
  milestoneIndex: number;
  milestoneTitle: string;
  amount: number;
  token: string;
  freelancerAddress?: string;
  submittedAt?: string;
  dueDate?: string;
}

export interface BulkPayoutTotals {
  /** Number of milestones selected for payout. */
  count: number;
  /** Sum of milestone amounts for the selected (single-token) batch. */
  payoutTotal: number;
  token: string;
  /** Total inclusion fees in stroops for the batched transaction. */
  networkFeeStroops: number;
  /** Total inclusion fees expressed in XLM. */
  networkFeeXlm: number;
  /** Wallet balance left after the payout, when a balance was supplied. */
  remainingBalance: number | null;
  /** True when the payout total exceeds the supplied balance. */
  exceedsBalance: boolean;
}

export interface BulkPayoutSummaryLine {
  token: string;
  amount: number;
  count: number;
}

/**
 * collectBulkPayoutMilestones (#308)
 *
 * Flattens every client project into submitted milestones that are eligible
 * for a batched release. Milestones without an on-chain project id cannot be
 * approved atomically and are excluded.
 */
export function collectBulkPayoutMilestones(projects: Project[] = []): BulkPayoutMilestone[] {
  return projects.flatMap((project) => {
    if (project.status === 'disputed' || project.status === 'completed') return [];
    if (project.project_id_onchain === undefined || project.project_id_onchain === null) return [];

    return (project.milestones || [])
      .filter((milestone) => milestone.status === 'submitted')
      .map((milestone) => ({
        key: `${project.id}:${milestone.milestone_index}`,
        milestoneId: milestone.id,
        projectId: project.id,
        onChainProjectId: project.project_id_onchain as number | string | bigint,
        projectTitle: project.title,
        milestoneIndex: milestone.milestone_index,
        milestoneTitle: milestone.title,
        amount: Number(milestone.amount) || 0,
        token: project.token || 'USDC',
        freelancerAddress: project.freelancer_address,
        submittedAt: milestone.submitted_at,
        dueDate: milestone.due_date,
      }));
  });
}

/**
 * Groups selected milestones per settlement token so the UI can display a
 * meaningful total instead of summing unrelated assets.
 */
export function summarizeBulkPayout(milestones: BulkPayoutMilestone[]): BulkPayoutSummaryLine[] {
  const byToken = new Map<string, BulkPayoutSummaryLine>();

  milestones.forEach((milestone) => {
    const current = byToken.get(milestone.token) ?? { token: milestone.token, amount: 0, count: 0 };
    current.amount += milestone.amount;
    current.count += 1;
    byToken.set(milestone.token, current);
  });

  return Array.from(byToken.values());
}

/**
 * calculateBulkPayoutTotals (#308)
 *
 * Computes the payout total, per-operation network fee and the balance left
 * after the batch, recalculating live as milestones are toggled.
 */
export function calculateBulkPayoutTotals(
  milestones: BulkPayoutMilestone[],
  options: { balance?: number | null; token?: string; baseFeeStroops?: number } = {}
): BulkPayoutTotals {
  const token = options.token || milestones[0]?.token || 'USDC';
  const selected = milestones.filter((milestone) => milestone.token === token);
  const payoutTotal = selected.reduce((sum, milestone) => sum + (Number(milestone.amount) || 0), 0);
  const baseFee = Number.isFinite(options.baseFeeStroops)
    ? Math.max(100, Number(options.baseFeeStroops))
    : DEFAULT_SOROBAN_BASE_FEE;
  const networkFeeStroops = baseFee * Math.max(1, selected.length);
  const remainingBalance =
    options.balance === undefined || options.balance === null
      ? null
      : Number((options.balance - payoutTotal).toFixed(7));

  return {
    count: selected.length,
    payoutTotal: Number(payoutTotal.toFixed(7)),
    token,
    networkFeeStroops,
    networkFeeXlm: Number((networkFeeStroops / 10_000_000).toFixed(7)),
    remainingBalance,
    exceedsBalance: remainingBalance !== null && remainingBalance < 0,
  };
}

/** Builds the `approve_milestone(project_id, index, platform)` arguments. */
export function buildApproveMilestoneArgs(
  milestone: BulkPayoutMilestone,
  platformAddress?: string
): xdr.ScVal[] {
  const platformScVal = platformAddress
    ? Address.fromString(platformAddress).toScVal()
    : xdr.ScVal.scvVoid();

  return [
    nativeToScVal(BigInt(milestone.onChainProjectId), { type: 'u64' }),
    nativeToScVal(Number(milestone.milestoneIndex), { type: 'u32' }),
    platformScVal,
  ];
}

/**
 * buildBulkApproveTransaction (#308)
 *
 * Packs one `approve_milestone` invocation per selected milestone into a
 * single transaction. Exposed separately from broadcasting so the batch
 * constructor can be unit tested without wallet/RPC access.
 */
export function buildBulkApproveTransaction(
  sourceAccount: Account,
  milestones: BulkPayoutMilestone[],
  options: {
    contractAddress?: string;
    platformAddress?: string;
    baseFeeStroops?: number;
    timeoutSeconds?: number;
  } = {}
) {
  if (milestones.length === 0) {
    throw new Error('Select at least one milestone to build a batch payout.');
  }

  const perOperationFee = BigInt(
    Number.isFinite(options.baseFeeStroops) ? Math.max(100, Number(options.baseFeeStroops)) : DEFAULT_SOROBAN_BASE_FEE
  );

  const builder = new TransactionBuilder(sourceAccount, {
    // TransactionBuilder multiplies this per-operation fee by the operation count.
    fee: perOperationFee.toString(),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  });

  milestones.forEach((milestone) => {
    builder.addOperation(
      Operation.invokeContractFunction({
        contract: options.contractAddress || DEFAULT_ESCROW_CONTRACT_ID,
        function: 'approve_milestone',
        args: buildApproveMilestoneArgs(milestone, options.platformAddress),
      })
    );
  });

  return builder.setTimeout(options.timeoutSeconds ?? 180).build();
}

export const BULK_PAYOUT_PROGRESS: Record<TxStage, number> = {
  preparing: 10,
  simulating: 30,
  signing: 55,
  submitting: 70,
  polling: 90,
  success: 100,
  error: 100,
};

export interface BulkPayoutResult extends SorobanTxResult {
  approvedCount: number;
  totals: BulkPayoutTotals;
}

/**
 * executeBulkPayout (#308)
 *
 * Signs and broadcasts one transaction containing every selected milestone
 * release, reporting unified progress for the batch.
 */
export async function executeBulkPayout(options: {
  callerAddress: string;
  milestones: BulkPayoutMilestone[];
  balance?: number | null;
  platformAddress?: string;
  contractAddress?: string;
  baseFeeStroops?: number;
  onProgress?: (progress: number, stage: TxStage, message: string) => void;
}): Promise<BulkPayoutResult> {
  const { callerAddress, milestones, onProgress } = options;

  if (milestones.length === 0) {
    throw new Error('Select at least one milestone to pay out.');
  }

  const token = milestones[0]?.token;
  if (milestones.some((milestone) => milestone.token !== token)) {
    throw new Error('Batch payouts must settle in a single token. Split mixed-token batches.');
  }

  const totals = calculateBulkPayoutTotals(milestones, {
    balance: options.balance,
    token,
    baseFeeStroops: options.baseFeeStroops,
  });

  if (totals.exceedsBalance) {
    throw new Error(`Batch payout exceeds your ${token} balance.`);
  }

  const result = await invokeSorobanBatch({
    callerAddress,
    baseFee: options.baseFeeStroops,
    calls: milestones.map((milestone) => ({
      functionName: 'approve_milestone',
      contractAddress: options.contractAddress,
      args: buildApproveMilestoneArgs(milestone, options.platformAddress),
    })),
    onStatusUpdate: (stage, message) => {
      onProgress?.(BULK_PAYOUT_PROGRESS[stage] ?? 0, stage, message);
    },
  });

  return { ...result, approvedCount: milestones.length, totals };
}
