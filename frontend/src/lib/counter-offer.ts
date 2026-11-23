/**
 * Two-way proposal counter-offer helpers (#150).
 *
 * Terms are keyed by milestone index so the client and freelancer can trade
 * counter-offers without losing track of which line changed.
 */

export type CounterOfferAuthor = 'client' | 'freelancer';
export type NegotiationAction = 'counter' | 'accept' | 'decline';
export type NegotiationStatus = 'none' | 'countered' | 'accepted' | 'declined';

export interface MilestoneTerms {
  milestone_index: number;
  title: string;
  amount: number;
  due_date?: string;
}

export interface CounterOffer {
  proposed_by: CounterOfferAuthor;
  milestones: MilestoneTerms[];
  total: number;
  note?: string;
  created_at: string;
}

export interface CounterOfferDiffRow {
  milestone_index: number;
  title: string;
  originalAmount: number;
  counterAmount: number;
  amountDelta: number;
  originalDueDate?: string;
  counterDueDate?: string;
  dueDateDeltaDays: number | null;
  changed: boolean;
}

export interface CounterOfferDiff {
  rows: CounterOfferDiffRow[];
  originalTotal: number;
  counterTotal: number;
  totalDelta: number;
  totalDeltaPct: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
}

function roundCurrency(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function normalizeMilestoneTerms(milestones: MilestoneTerms[]): MilestoneTerms[] {
  return milestones
    .map((milestone, index) => ({
      milestone_index:
        typeof milestone.milestone_index === 'number' ? milestone.milestone_index : index,
      title: milestone.title || `Milestone ${index + 1}`,
      amount: Number(milestone.amount) || 0,
      due_date: milestone.due_date || undefined,
    }))
    .sort((a, b) => a.milestone_index - b.milestone_index);
}

export function calculateTermsTotal(milestones: MilestoneTerms[]): number {
  return roundCurrency(
    milestones.reduce((sum, milestone) => sum + (Number(milestone.amount) || 0), 0)
  );
}

export function buildCounterOfferDiff(
  original: MilestoneTerms[],
  counter: MilestoneTerms[]
): CounterOfferDiff {
  const originalTerms = normalizeMilestoneTerms(original);
  const counterTerms = normalizeMilestoneTerms(counter);
  const counterByIndex = new Map(counterTerms.map((term) => [term.milestone_index, term]));

  const rows: CounterOfferDiffRow[] = originalTerms.map((term) => {
    const counterTerm = counterByIndex.get(term.milestone_index) || term;
    const originalDue = parseDate(term.due_date);
    const counterDue = parseDate(counterTerm.due_date);
    const dueDateDeltaDays =
      originalDue && counterDue
        ? Math.round((counterDue.getTime() - originalDue.getTime()) / DAY_MS)
        : null;

    return {
      milestone_index: term.milestone_index,
      title: counterTerm.title || term.title,
      originalAmount: roundCurrency(term.amount),
      counterAmount: roundCurrency(counterTerm.amount),
      amountDelta: roundCurrency(counterTerm.amount - term.amount),
      originalDueDate: term.due_date,
      counterDueDate: counterTerm.due_date,
      dueDateDeltaDays,
      changed:
        roundCurrency(counterTerm.amount) !== roundCurrency(term.amount) ||
        (counterTerm.due_date || '') !== (term.due_date || ''),
    };
  });

  // Terms added by the counter-offer that were not in the original proposal.
  counterTerms
    .filter((term) => !originalTerms.some((original) => original.milestone_index === term.milestone_index))
    .forEach((term) => {
      rows.push({
        milestone_index: term.milestone_index,
        title: term.title,
        originalAmount: 0,
        counterAmount: roundCurrency(term.amount),
        amountDelta: roundCurrency(term.amount),
        originalDueDate: undefined,
        counterDueDate: term.due_date,
        dueDateDeltaDays: null,
        changed: true,
      });
    });

  const originalTotal = calculateTermsTotal(originalTerms);
  const counterTotal = calculateTermsTotal(counterTerms);
  const totalDelta = roundCurrency(counterTotal - originalTotal);
  const totalDeltaPct =
    originalTotal > 0 ? Math.round((totalDelta / originalTotal) * 10000) / 100 : 0;

  return {
    rows,
    originalTotal,
    counterTotal,
    totalDelta,
    totalDeltaPct,
  };
}

export interface CounterOfferValidation {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateCounterOfferTerms(terms: MilestoneTerms[]): CounterOfferValidation {
  const errors: Record<string, string> = {};
  if (!Array.isArray(terms) || terms.length === 0) {
    return { valid: false, errors: { milestones: 'At least one milestone is required' } };
  }

  terms.forEach((term, index) => {
    const amount = Number(term.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors[`milestone-${index}-amount`] = 'Amount must be greater than 0';
    }
    if (term.due_date && !parseDate(term.due_date)) {
      errors[`milestone-${index}-due_date`] = 'Enter a valid due date';
    }
  });

  return { valid: Object.keys(errors).length === 0, errors };
}

export function createCounterOffer(
  terms: MilestoneTerms[],
  proposedBy: CounterOfferAuthor,
  note?: string,
  now: Date | string = new Date()
): CounterOffer {
  const milestones = normalizeMilestoneTerms(terms);
  return {
    proposed_by: proposedBy,
    milestones,
    total: calculateTermsTotal(milestones),
    note: note?.trim() || undefined,
    created_at: new Date(now).toISOString(),
  };
}

/** Human-readable label for the next action the recipient can take. */
export function describeNegotiationStatus(
  status: NegotiationStatus | undefined,
  author?: CounterOfferAuthor
): string {
  switch (status) {
    case 'countered':
      return `Counter-offer received from ${author === 'freelancer' ? 'the freelancer' : 'the client'}`;
    case 'accepted':
      return 'Terms agreed and locked into the project';
    case 'declined':
      return 'Counter-offer declined';
    default:
      return 'No counter-offer yet';
  }
}
