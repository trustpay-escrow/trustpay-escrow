import { describe, expect, it } from 'vitest';
import {
  FEE_MULTIPLIERS,
  MIN_BASE_FEE_STROOPS,
  buildFeeSelection,
  calculateTierFee,
  estimateInclusionSeconds,
  parseFeeStats,
  type HorizonFeeStats,
} from './fee-estimator';

const STATS: HorizonFeeStats = {
  last_ledger_base_fee: '100',
  ledger_capacity_usage: '0.12',
  fee_charged: { min: '100', mode: '100', p50: '100', p90: '150', p99: '400', max: '5000' },
};

describe('fee multipliers (#256)', () => {
  it('uses 1x / 1.5x / 2x for Standard / Fast / Urgent', () => {
    expect(FEE_MULTIPLIERS).toEqual({ standard: 1, fast: 1.5, urgent: 2 });
  });

  it('calculates each tier from the base fee', () => {
    expect(calculateTierFee(100, 'standard')).toBe(100);
    expect(calculateTierFee(100, 'fast')).toBe(150);
    expect(calculateTierFee(100, 'urgent')).toBe(200);
    expect(calculateTierFee(1000, 'fast')).toBe(1500);
  });

  it('rounds up and never goes below the network minimum', () => {
    expect(calculateTierFee(101, 'fast')).toBe(152); // 151.5 -> 152
    expect(calculateTierFee(10, 'standard')).toBe(MIN_BASE_FEE_STROOPS);
    expect(calculateTierFee(10, 'urgent', 100)).toBe(100);
  });

  it('builds a selection carrying the tier, multiplier and fee', () => {
    expect(buildFeeSelection({ baseFee: 200, minBaseFee: 100 }, 'urgent')).toEqual({
      tier: 'urgent',
      multiplier: 2,
      feeStroops: 400,
    });
  });
});

describe('parseFeeStats', () => {
  it('reads the 5-ledger base fee and surge fee from Horizon', () => {
    const fees = parseFeeStats(STATS, 1);
    expect(fees).toMatchObject({ baseFee: 100, surgeFee: 400, minBaseFee: 100, capacityUsage: 0.12 });
    expect(fees.isSurging).toBe(true); // p99 is 4x the base fee
  });

  it('is not surging in quiet conditions', () => {
    const fees = parseFeeStats({ ...STATS, fee_charged: { ...STATS.fee_charged, p99: '120' } });
    expect(fees.isSurging).toBe(false);
  });

  it('falls back to safe defaults for malformed values', () => {
    const fees = parseFeeStats({
      last_ledger_base_fee: 'x',
      ledger_capacity_usage: 'nope',
      fee_charged: { min: '', mode: '', p50: '', p90: '', p99: '', max: '' },
    });
    expect(fees.baseFee).toBe(MIN_BASE_FEE_STROOPS);
    expect(fees.surgeFee).toBe(MIN_BASE_FEE_STROOPS);
    expect(fees.capacityUsage).toBe(0);
  });
});

describe('inclusion time estimate', () => {
  it('is under 3 seconds for Standard on a quiet network', () => {
    expect(estimateInclusionSeconds('standard', 0.1)).toBeLessThan(3);
  });

  it('is fastest for Urgent and slows Standard the most under congestion', () => {
    const quiet = [0.1, 0.1, 0.1].map((c, i) => estimateInclusionSeconds(['standard', 'fast', 'urgent'][i] as never, c));
    expect(quiet[2]).toBeLessThan(quiet[1]);
    expect(quiet[1]).toBeLessThan(quiet[0]);
    const busy = (t: 'standard' | 'fast' | 'urgent') => estimateInclusionSeconds(t, 1);
    expect(busy('standard') - estimateInclusionSeconds('standard', 0.1)).toBeGreaterThan(
      busy('urgent') - estimateInclusionSeconds('urgent', 0.1)
    );
  });
});
