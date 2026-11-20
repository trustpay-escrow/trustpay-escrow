export interface AmmPoolReserves {
  reserveBase: number;
  reserveQuote: number;
  feeBps?: number;
}

export interface TranchePlan {
  trancheCount: number;
  amountPerTranche: number;
  priceImpactPct: number;
  totalReceived: number;
  directReceived: number;
  savedTokens: number;
  savedPct: number;
  isCapped: boolean;
}

export interface LiquidityQuote {
  spotPrice: number;
  amountOut: number;
  priceImpactPct: number;
  directDepositValue: number;
  pathSwapValue: number;
  pathCost: number;
  pathCostPct: number;
  tranchePlan: TranchePlan | null;
  optimizedValue: number;
  optimizedCost: number;
  optimizedCostPct: number;
  withinThreshold: boolean;
}

export const DEFAULT_POOL_FEE_BPS = 30;
export const DEFAULT_MAX_IMPACT_PCT = 1.0;
export const MAX_RECOMMENDED_TRANCHES = 50;

function positive(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

export function normalizeFeeBps(feeBps?: number): number {
  if (feeBps === undefined || feeBps === null) return DEFAULT_POOL_FEE_BPS;
  const numeric = Number(feeBps);
  if (!Number.isFinite(numeric) || numeric < 0) return DEFAULT_POOL_FEE_BPS;
  return Math.min(numeric, 10000);
}

function normalizeMaxImpactPct(maxImpactPct?: number): number {
  if (maxImpactPct === undefined || maxImpactPct === null) return DEFAULT_MAX_IMPACT_PCT;
  const numeric = Number(maxImpactPct);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric >= 100) return DEFAULT_MAX_IMPACT_PCT;
  return numeric;
}

export function getSpotPrice(reserveBase: number, reserveQuote: number): number {
  const base = positive(reserveBase);
  const quote = positive(reserveQuote);
  return base > 0 && quote > 0 ? quote / base : 0;
}

export function getAmountOut(
  amountIn: number,
  reserveIn: number,
  reserveOut: number,
  feeBps?: number
): number {
  const amount = positive(amountIn);
  const reserveInput = positive(reserveIn);
  const reserveOutput = positive(reserveOut);
  if (amount === 0 || reserveInput === 0 || reserveOutput === 0) return 0;

  const fee = normalizeFeeBps(feeBps) / 10000;
  const effectiveIn = amount * (1 - fee);
  if (effectiveIn <= 0) return 0;
  return (effectiveIn * reserveOutput) / (reserveInput + effectiveIn);
}

export function calculatePriceImpactPct(
  amountIn: number,
  reserveIn: number,
  reserveOut: number,
  feeBps?: number
): number {
  const amount = positive(amountIn);
  const reserveInput = positive(reserveIn);
  const reserveOutput = positive(reserveOut);
  if (amount === 0 || reserveInput === 0 || reserveOutput === 0) return 0;

  const amountOut = getAmountOut(amount, reserveInput, reserveOutput, feeBps);
  const idealOut = amount * (reserveOutput / reserveInput);
  const fee = normalizeFeeBps(feeBps) / 10000;
  if (idealOut === 0 || amountOut === 0) return fee >= 1 ? 100 : 0;

  const impact = (1 - amountOut / idealOut) * 100;
  return Math.min(100, Math.max(0, impact));
}

export function getMaxTrancheSize(
  reserveIn: number,
  feeBps?: number,
  maxImpactPct?: number
): number {
  const reserveInput = positive(reserveIn);
  const threshold = normalizeMaxImpactPct(maxImpactPct) / 100;
  const fee = normalizeFeeBps(feeBps) / 10000;
  if (reserveInput === 0 || threshold <= 0 || threshold >= 1 || threshold <= fee) return 0;
  return (reserveInput * (threshold - fee)) / ((1 - threshold) * (1 - fee));
}

export function planTranches(params: {
  amountIn: number;
  reserveIn: number;
  reserveQuote: number;
  feeBps?: number;
  maxImpactPct?: number;
}): TranchePlan | null {
  const amount = positive(params.amountIn);
  const reserveInput = positive(params.reserveIn);
  const reserveOutput = positive(params.reserveQuote);
  const feeBps = normalizeFeeBps(params.feeBps);
  const maxImpactPct = normalizeMaxImpactPct(params.maxImpactPct);

  if (amount === 0 || reserveInput === 0 || reserveOutput === 0) return null;
  if (calculatePriceImpactPct(amount, reserveInput, reserveOutput, feeBps) <= maxImpactPct) return null;

  const maxTrancheSize = getMaxTrancheSize(reserveInput, feeBps, maxImpactPct);
  if (maxTrancheSize === 0) return null;

  const requiredTranches = Math.ceil(amount / maxTrancheSize - 1e-9);
  if (!Number.isFinite(requiredTranches) || requiredTranches < 2) return null;
  const trancheCount = Math.min(requiredTranches, MAX_RECOMMENDED_TRANCHES);
  const amountPerTranche = amount / trancheCount;

  let totalReceived = 0;
  for (let index = 0; index < trancheCount; index += 1) {
    totalReceived += getAmountOut(amountPerTranche, reserveInput, reserveOutput, feeBps);
  }

  const directReceived = getAmountOut(amount, reserveInput, reserveOutput, feeBps);
  const savedTokens = totalReceived - directReceived;
  return {
    trancheCount,
    amountPerTranche,
    priceImpactPct: calculatePriceImpactPct(amountPerTranche, reserveInput, reserveOutput, feeBps),
    totalReceived,
    directReceived,
    savedTokens,
    savedPct: directReceived > 0 ? (savedTokens / directReceived) * 100 : 0,
    isCapped: requiredTranches > MAX_RECOMMENDED_TRANCHES,
  };
}

export function getLiquidityQuote(params: {
  amountIn: number;
  reserves: AmmPoolReserves;
  maxImpactPct?: number;
}): LiquidityQuote | null {
  const amount = positive(params.amountIn);
  const reserveInput = positive(params.reserves?.reserveBase);
  const reserveOutput = positive(params.reserves?.reserveQuote);
  if (amount === 0 || reserveInput === 0 || reserveOutput === 0) return null;

  const feeBps = normalizeFeeBps(params.reserves.feeBps);
  const maxImpactPct = normalizeMaxImpactPct(params.maxImpactPct);
  const spotPrice = getSpotPrice(reserveInput, reserveOutput);
  const amountOut = getAmountOut(amount, reserveInput, reserveOutput, feeBps);
  const priceImpactPct = calculatePriceImpactPct(amount, reserveInput, reserveOutput, feeBps);

  const pathSwapValue = amountOut / spotPrice;
  const pathCost = amount - pathSwapValue;
  const tranchePlan = planTranches({
    amountIn: amount,
    reserveIn: reserveInput,
    reserveQuote: reserveOutput,
    feeBps,
    maxImpactPct,
  });
  const optimizedValue = tranchePlan ? tranchePlan.totalReceived / spotPrice : pathSwapValue;
  const optimizedCost = amount - optimizedValue;

  return {
    spotPrice,
    amountOut,
    priceImpactPct,
    directDepositValue: amount,
    pathSwapValue,
    pathCost,
    pathCostPct: amount > 0 ? (pathCost / amount) * 100 : 0,
    tranchePlan,
    optimizedValue,
    optimizedCost,
    optimizedCostPct: amount > 0 ? (optimizedCost / amount) * 100 : 0,
    withinThreshold: priceImpactPct <= maxImpactPct,
  };
}
