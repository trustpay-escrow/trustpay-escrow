import { describe, it, expect } from 'vitest';
import {
  calculatePriceImpactPct,
  getAmountOut,
  getLiquidityQuote,
  getMaxTrancheSize,
  getSpotPrice,
  planTranches,
} from './liquidity-depth';

describe('constant-product AMM price impact', () => {
  it('returns the exact fee-free constant-product output and preserves k', () => {
    const reserveIn = 1_000_000;
    const reserveOut = 1_000_000;
    const amountIn = 100_000;
    const output = getAmountOut(amountIn, reserveIn, reserveOut, 0);

    expect(output).toBeCloseTo(90_909.0909, 3);
    expect((reserveIn + amountIn) * (reserveOut - output)).toBeCloseTo(reserveIn * reserveOut, 2);
  });

  it('reduces output by the pool fee', () => {
    const withoutFee = getAmountOut(10_000, 500_000, 500_000, 0);
    const withFee = getAmountOut(10_000, 500_000, 500_000, 30);
    expect(withFee).toBeLessThan(withoutFee);
    expect(withFee).toBeCloseTo((10_000 * 0.997 * 500_000) / (500_000 + 10_000 * 0.997), 4);
  });

  it('scales impact with trade size for the same pool', () => {
    const small = calculatePriceImpactPct(1_000, 1_000_000, 1_000_000, 0);
    const medium = calculatePriceImpactPct(10_000, 1_000_000, 1_000_000, 0);
    const large = calculatePriceImpactPct(100_000, 1_000_000, 1_000_000, 0);

    expect(small).toBeCloseTo(100 / 1001, 6);
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);
  });

  it('halves the impact when both reserves are doubled', () => {
    const shallow = calculatePriceImpactPct(10_000, 200_000, 400_000, 0);
    const deep = calculatePriceImpactPct(10_000, 400_000, 800_000, 0);

    expect(shallow).toBeCloseTo(10_000 / 210_000 * 100, 6);
    expect(deep).toBeLessThan(shallow);
    expect(deep / shallow).toBeCloseTo(0.5, 1);
    expect(getSpotPrice(200_000, 400_000)).toBeCloseTo(getSpotPrice(400_000, 800_000), 8);
  });

  it('includes the pool fee in the reported slippage', () => {
    const withoutFee = calculatePriceImpactPct(10_000, 1_000_000, 1_000_000, 0);
    const withFee = calculatePriceImpactPct(10_000, 1_000_000, 1_000_000, 30);
    expect(withFee).toBeGreaterThan(withoutFee);
    expect(withoutFee).toBeCloseTo(100 / 101, 6);
  });

  it('handles zero, negative and non-finite inputs without breaking', () => {
    expect(calculatePriceImpactPct(0, 100, 100)).toBe(0);
    expect(calculatePriceImpactPct(-5, 100, 100)).toBe(0);
    expect(calculatePriceImpactPct(10, 0, 100)).toBe(0);
    expect(calculatePriceImpactPct(10, 100, Number.NaN)).toBe(0);
    expect(getAmountOut(10, 100, 100, 10_000)).toBe(0);
    expect(getSpotPrice(0, 100)).toBe(0);
  });
});

describe('max tranche size and multi-tranche plan', () => {
  it('derives the exact tranche size that stays under the impact threshold', () => {
    const maxTranche = getMaxTrancheSize(1_000_000, 0, 1);
    expect(maxTranche).toBeCloseTo(1_000_000 / 99, 6);
    expect(calculatePriceImpactPct(maxTranche, 1_000_000, 1_000_000, 0)).toBeCloseTo(1, 6);
  });

  it('returns no tranche size when the fee alone exceeds the threshold', () => {
    expect(getMaxTrancheSize(1_000_000, 30, 0.2)).toBe(0);
  });

  it('recommends splitting a large swap and reduces the total loss', () => {
    const params = {
      amountIn: 100_000,
      reserveIn: 820_000,
      reserveQuote: 640_000,
      feeBps: 30,
      maxImpactPct: 1,
    };
    const plan = planTranches(params);

    expect(plan).not.toBeNull();
    expect(plan!.trancheCount).toBeGreaterThan(1);
    expect(plan!.amountPerTranche * plan!.trancheCount).toBeCloseTo(params.amountIn, 6);
    expect(plan!.priceImpactPct).toBeLessThanOrEqual(params.maxImpactPct);
    expect(plan!.totalReceived).toBeGreaterThan(plan!.directReceived);
    expect(plan!.savedTokens).toBeGreaterThan(0);
    expect(plan!.savedPct).toBeGreaterThan(0);
  });

  it('does not recommend splitting a swap already inside the threshold', () => {
    expect(planTranches({ amountIn: 1_000, reserveIn: 5_000_000, reserveQuote: 4_000_000, maxImpactPct: 1 })).toBeNull();
  });
});

describe('net cost quote', () => {
  it('compares a direct stablecoin deposit with the DEX path swap', () => {
    const quote = getLiquidityQuote({
      amountIn: 50_000,
      reserves: { reserveBase: 100_000, reserveQuote: 90_000, feeBps: 30 },
    });

    expect(quote).not.toBeNull();
    expect(quote!.directDepositValue).toBe(50_000);
    expect(quote!.pathSwapValue).toBeLessThan(quote!.directDepositValue);
    expect(quote!.pathCost).toBeGreaterThan(0);
    expect(quote!.pathCostPct).toBeCloseTo(quote!.priceImpactPct, 8);
    expect(quote!.withinThreshold).toBe(false);
    expect(quote!.optimizedValue).toBeGreaterThan(quote!.pathSwapValue);
    expect(quote!.optimizedCost).toBeLessThan(quote!.pathCost);
    expect(quote!.tranchePlan).not.toBeNull();
  });

  it('flags a deep pool as safe and keeps the direct deposit as the best path', () => {
    const quote = getLiquidityQuote({
      amountIn: 5_000,
      reserves: { reserveBase: 10_000_000, reserveQuote: 9_000_000, feeBps: 30 },
      maxImpactPct: 1,
    });

    expect(quote!.withinThreshold).toBe(true);
    expect(quote!.tranchePlan).toBeNull();
    expect(quote!.optimizedValue).toBeCloseTo(quote!.pathSwapValue, 8);
  });

  it('returns null for invalid reserves or amounts', () => {
    expect(getLiquidityQuote({ amountIn: 100, reserves: { reserveBase: 0, reserveQuote: 100 } })).toBeNull();
    expect(getLiquidityQuote({ amountIn: 0, reserves: { reserveBase: 100, reserveQuote: 100 } })).toBeNull();
  });
});
