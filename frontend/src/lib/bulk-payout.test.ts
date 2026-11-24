import { describe, expect, it } from 'vitest';
import { Account } from '@stellar/stellar-sdk';
import type { Project } from '@/types';
import {
  buildBulkApproveTransaction,
  calculateBulkPayoutTotals,
  collectBulkPayoutMilestones,
  summarizeBulkPayout,
  type BulkPayoutMilestone,
} from './bulk-payout';

const CLIENT = 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5';
const FREELANCER = 'GDFLMVB4TWEBF3EXD66IYLCZE2G75JWZ5ICPKBWPEW7EE5CCLJQGFHAX';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    title: 'Soroban audit',
    description: '',
    category: 'Security',
    budget: 3000,
    token: 'USDC',
    status: 'in_progress',
    project_id_onchain: 7,
    freelancer_address: FREELANCER,
    milestones: [
      {
        id: 'm1',
        milestone_index: 0,
        title: 'Scope review',
        amount: 1000,
        status: 'submitted',
        submitted_at: '2026-11-20T00:00:00.000Z',
      },
      {
        id: 'm2',
        milestone_index: 1,
        title: 'Final report',
        amount: 1500,
        status: 'approved',
      },
      {
        id: 'm3',
        milestone_index: 2,
        title: 'Remediation',
        amount: 500,
        status: 'submitted',
      },
    ],
    ...overrides,
  };
}

describe('collectBulkPayoutMilestones (#308)', () => {
  it('returns only submitted milestones from payable projects', () => {
    const milestones = collectBulkPayoutMilestones([
      project(),
      project({ id: 'p2', status: 'disputed', title: 'Disputed work' }),
      project({ id: 'p3', status: 'completed', title: 'Done' }),
      project({ id: 'p4', project_id_onchain: undefined, title: 'Not funded' }),
    ]);

    expect(milestones).toHaveLength(2);
    expect(milestones.map((milestone) => milestone.milestoneTitle)).toEqual([
      'Scope review',
      'Remediation',
    ]);
    expect(milestones[0]).toMatchObject({
      key: 'p1:0',
      projectId: 'p1',
      onChainProjectId: 7,
      amount: 1000,
      token: 'USDC',
    });
  });

  it('summarizes totals per settlement token', () => {
    const milestones = collectBulkPayoutMilestones([
      project(),
      project({ id: 'p2', token: 'XLM', milestones: [{ id: 'x', milestone_index: 0, title: 'X', amount: 25, status: 'submitted' }] }),
    ]);

    expect(summarizeBulkPayout(milestones)).toEqual([
      { token: 'USDC', amount: 1500, count: 2 },
      { token: 'XLM', amount: 25, count: 1 },
    ]);
  });
});

describe('calculateBulkPayoutTotals (#308)', () => {
  const milestones = collectBulkPayoutMilestones([project()]);

  it('recalculates payout, fee and remaining balance as milestones toggle', () => {
    const none = calculateBulkPayoutTotals([], { balance: 5000, token: 'USDC', baseFeeStroops: 1000 });
    expect(none).toMatchObject({ count: 0, payoutTotal: 0, networkFeeStroops: 1000, remainingBalance: 5000 });

    const one = calculateBulkPayoutTotals([milestones[0]], {
      balance: 5000,
      token: 'USDC',
      baseFeeStroops: 1000,
    });
    expect(one).toMatchObject({
      count: 1,
      payoutTotal: 1000,
      networkFeeStroops: 1000,
      networkFeeXlm: 0.0001,
      remainingBalance: 4000,
      exceedsBalance: false,
    });

    const both = calculateBulkPayoutTotals(milestones, {
      balance: 1200,
      token: 'USDC',
      baseFeeStroops: 1000,
    });
    expect(both).toMatchObject({
      count: 2,
      payoutTotal: 1500,
      networkFeeStroops: 2000,
      remainingBalance: -300,
      exceedsBalance: true,
    });
  });
});

describe('buildBulkApproveTransaction (#308)', () => {
  it('packs one approve_milestone invocation per selected milestone', () => {
    const milestones = collectBulkPayoutMilestones([project()]);
    const account = new Account(CLIENT, '1234');
    const transaction = buildBulkApproveTransaction(account, milestones, { baseFeeStroops: 1000 });

    expect(transaction.operations).toHaveLength(2);
    expect(transaction.operations.every((operation) => operation.type === 'invokeHostFunction')).toBe(true);
    // Stellar charges the inclusion fee per operation.
    expect(transaction.fee).toBe('2000');
    expect(transaction.sequence).toBe('1235');
  });

  it('rejects empty batches', () => {
    const account = new Account(CLIENT, '1');
    expect(() => buildBulkApproveTransaction(account, [])).toThrow(/at least one milestone/i);
  });
});

describe('BulkPayoutMilestone shape', () => {
  it('keeps selection keys unique across projects and milestone indexes', () => {
    const milestones: BulkPayoutMilestone[] = collectBulkPayoutMilestones([
      project(),
      project({ id: 'p9', milestones: [{ id: 'z', milestone_index: 0, title: 'Other', amount: 1, status: 'submitted' }] }),
    ]);
    const keys = milestones.map((milestone) => milestone.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
