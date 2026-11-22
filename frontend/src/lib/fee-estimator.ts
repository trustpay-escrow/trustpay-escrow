/**
 * Stellar network fee maths for the gas fee estimator (#256).
 *
 * Pure functions: Horizon's `/fee_stats` supplies the inputs, this module
 * turns them into speed presets and inclusion-time estimates.
 */

/** Network minimum base fee, in stroops (1 stroop = 0.0000001 XLM). */
export const MIN_BASE_FEE_STROOPS = 100;
export const STROOPS_PER_XLM = 10_000_000;

export type FeeTier = 'standard' | 'fast' | 'urgent';

export const FEE_TIERS: readonly FeeTier[] = ['standard', 'fast', 'urgent'];

/** Standard = the base fee, Fast = 1.5x, Urgent = 2x. */
export const FEE_MULTIPLIERS: Record<FeeTier, number> = {
  standard: 1,
  fast: 1.5,
  urgent: 2,
};

export const FEE_TIER_LABELS: Record<FeeTier, string> = {
  standard: 'Standard',
  fast: 'Fast',
  urgent: 'Urgent',
};

/** Subset of Horizon's `/fee_stats` response (values are stroop strings). */
export interface HorizonFeeStats {
  last_ledger_base_fee: string;
  ledger_capacity_usage: string;
  fee_charged: {
    min: string;
    mode: string;
    p50: string;
    p90: string;
    p99: string;
    max: string;
  };
}

export interface NetworkFees {
  /** Average base fee over the last 5 ledgers, in stroops. */
  baseFee: number;
  /** Fee needed to clear a surge (p99 of recently charged fees), in stroops. */
  surgeFee: number;
  /** Network minimum base fee reported for the last ledger. */
  minBaseFee: number;
  /** Share of the last ledger's capacity in use, 0..1. */
  capacityUsage: number;
  /** The network is surging: the surge fee is well above the base fee. */
  isSurging: boolean;
  fetchedAt: number;
}

export interface FeeSelection {
  tier: FeeTier;
  /** Base (inclusion) fee to put on the transaction, in stroops. */
  feeStroops: number;
  multiplier: number;
}

function toNumber(value: string | number | undefined, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Normalises a Horizon `/fee_stats` payload. */
export function parseFeeStats(stats: HorizonFeeStats, now = Date.now()): NetworkFees {
  const minBaseFee = toNumber(stats.last_ledger_base_fee, MIN_BASE_FEE_STROOPS);
  const baseFee = Math.max(
    minBaseFee,
    toNumber(stats.fee_charged?.mode, toNumber(stats.fee_charged?.p50, minBaseFee))
  );
  const surgeFee = Math.max(baseFee, toNumber(stats.fee_charged?.p99, baseFee));
  const capacityUsage = Math.min(1, Math.max(0, Number(stats.ledger_capacity_usage) || 0));
  return {
    baseFee,
    surgeFee,
    minBaseFee,
    capacityUsage,
    isSurging: surgeFee >= baseFee * 2 || capacityUsage >= 0.9,
    fetchedAt: now,
  };
}

/** Fee for a tier: base x multiplier, rounded up, never below the network minimum. */
export function calculateTierFee(baseFee: number, tier: FeeTier, minBaseFee = MIN_BASE_FEE_STROOPS): number {
  return Math.max(minBaseFee, Math.ceil(baseFee * FEE_MULTIPLIERS[tier]));
}

export function buildFeeSelection(fees: Pick<NetworkFees, 'baseFee' | 'minBaseFee'>, tier: FeeTier): FeeSelection {
  return {
    tier,
    multiplier: FEE_MULTIPLIERS[tier],
    feeStroops: calculateTierFee(fees.baseFee, tier, fees.minBaseFee),
  };
}

/**
 * Estimated seconds until inclusion. In normal conditions every tier lands in
 * the next ledger (about 5 s close time, but inclusion is decided in the
 * first ~2-3 s of nomination), so Standard stays under 3 s. As the ledger
 * fills, lower tiers wait longer while higher tiers are bumped ahead.
 */
export function estimateInclusionSeconds(tier: FeeTier, capacityUsage: number): number {
  const base: Record<FeeTier, number> = { standard: 2.5, fast: 2, urgent: 1.5 };
  const congestion = Math.max(0, Math.min(1, (capacityUsage - 0.7) / 0.3));
  const penalty: Record<FeeTier, number> = { standard: 6, fast: 3, urgent: 1 };
  return Math.round((base[tier] + congestion * penalty[tier]) * 10) / 10;
}

export function stroopsToXlm(stroops: number): number {
  return stroops / STROOPS_PER_XLM;
}

export function formatStroops(stroops: number): string {
  return `${stroops.toLocaleString('en-US')} stroops`;
}
