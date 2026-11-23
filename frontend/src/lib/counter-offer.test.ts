import { describe, expect, it } from 'vitest';
import {
  buildCounterOfferDiff,
  calculateTermsTotal,
  createCounterOffer,
  describeNegotiationStatus,
  validateCounterOfferTerms,
} from './counter-offer';

const original = [
  { milestone_index: 0, title: 'Design', amount: 1000, due_date: '2026-02-01' },
  { milestone_index: 1, title: 'Build', amount: 3000, due_date: '2026-03-01' },
];

describe('buildCounterOfferDiff', () => {
  it('renders original versus modified amounts and totals', () => {
    const counter = [
      { milestone_index: 0, title: 'Design', amount: 1200, due_date: '2026-02-05' },
      { milestone_index: 1, title: 'Build', amount: 2800, due_date: '2026-03-01' },
    ];
    const diff = buildCounterOfferDiff(original, counter);

    expect(diff.rows).toHaveLength(2);
    expect(diff.rows[0].amountDelta).toBe(200);
    expect(diff.rows[1].amountDelta).toBe(-200);
    expect(diff.rows[0].dueDateDeltaDays).toBe(4);
    expect(diff.originalTotal).toBe(4000);
    expect(diff.counterTotal).toBe(4000);
    expect(diff.totalDelta).toBe(0);
    expect(diff.rows[0].changed).toBe(true);
  });

  it('calculates percentage change and marks unchanged rows', () => {
    const diff = buildCounterOfferDiff(original, [
      { milestone_index: 0, title: 'Design', amount: 1000, due_date: '2026-02-01' },
      { milestone_index: 1, title: 'Build', amount: 4000, due_date: '2026-03-01' },
    ]);

    expect(diff.totalDelta).toBe(1000);
    expect(diff.totalDeltaPct).toBe(25);
    expect(diff.rows[0].changed).toBe(false);
    expect(diff.rows[1].changed).toBe(true);
  });

  it('includes milestones added by the counter-offer', () => {
    const diff = buildCounterOfferDiff(original, [
      ...original,
      { milestone_index: 2, title: 'Launch support', amount: 500, due_date: '2026-03-15' },
    ]);

    expect(diff.rows).toHaveLength(3);
    expect(diff.rows[2].originalAmount).toBe(0);
    expect(diff.rows[2].counterAmount).toBe(500);
    expect(diff.counterTotal).toBe(4500);
  });
});

describe('validateCounterOfferTerms', () => {
  it('accepts valid terms', () => {
    expect(validateCounterOfferTerms(original).valid).toBe(true);
  });

  it('rejects empty, zero, and invalid-date terms', () => {
    expect(validateCounterOfferTerms([]).valid).toBe(false);

    const invalid = validateCounterOfferTerms([
      { milestone_index: 0, title: 'Design', amount: 0, due_date: 'not-a-date' },
    ]);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors['milestone-0-amount']).toBeTruthy();
    expect(invalid.errors['milestone-0-due_date']).toBeTruthy();
  });
});

describe('createCounterOffer', () => {
  it('normalises order, totals, author, and timestamp', () => {
    const offer = createCounterOffer(
      [original[1], original[0]],
      'client',
      '  Revised scope  ',
      '2026-01-15T12:00:00Z'
    );

    expect(offer.proposed_by).toBe('client');
    expect(offer.milestones.map((term) => term.milestone_index)).toEqual([0, 1]);
    expect(offer.total).toBe(4000);
    expect(offer.note).toBe('Revised scope');
    expect(offer.created_at).toBe('2026-01-15T12:00:00.000Z');
    expect(calculateTermsTotal(offer.milestones)).toBe(4000);
  });
});

describe('describeNegotiationStatus', () => {
  it('labels each negotiation state', () => {
    expect(describeNegotiationStatus('countered', 'client')).toContain('client');
    expect(describeNegotiationStatus('accepted')).toContain('locked');
    expect(describeNegotiationStatus(undefined)).toContain('No counter-offer');
  });
});
