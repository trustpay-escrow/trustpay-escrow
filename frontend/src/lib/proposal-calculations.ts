export interface MilestoneEstimate {
  id: string;
  hours: number;
}

export interface ProposalQuote {
  gross: number;
  serviceFee: number;
  net: number;
  milestones: Array<MilestoneEstimate & { amount: number }>;
}

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Produces a predictable fixed-price proposal from an hourly estimate. The
 * resulting milestone amounts retain the same ratio as the supplied hours.
 */
export function calculateProposalQuote(
  hourlyRate: number,
  milestones: MilestoneEstimate[],
  serviceFeeRate = 0,
): ProposalQuote {
  const safeRate = Number.isFinite(hourlyRate) && hourlyRate > 0 ? hourlyRate : 0;
  const safeFeeRate = Math.min(Math.max(serviceFeeRate, 0), 1);
  const totalHours = milestones.reduce((total, milestone) => total + Math.max(milestone.hours, 0), 0);
  const gross = roundCurrency(safeRate * totalHours);

  return {
    gross,
    serviceFee: roundCurrency(gross * safeFeeRate),
    net: roundCurrency(gross * (1 - safeFeeRate)),
    milestones: milestones.map((milestone) => ({
      ...milestone,
      amount: roundCurrency(safeRate * Math.max(milestone.hours, 0)),
    })),
  };
}

export function convertCurrency(amount: number, exchangeRate: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(exchangeRate) || exchangeRate < 0) return 0;
  return roundCurrency(amount * exchangeRate);
}
