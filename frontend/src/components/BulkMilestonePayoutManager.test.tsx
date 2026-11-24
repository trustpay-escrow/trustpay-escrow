import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Project } from '@/types';
import { BulkMilestonePayoutManager } from './BulkMilestonePayoutManager';

const executeBulkPayout = vi.fn();

vi.mock('@/lib/bulk-payout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bulk-payout')>();
  return {
    ...actual,
    executeBulkPayout: (...args: unknown[]) => executeBulkPayout(...args),
  };
});

const projects: Project[] = [
  {
    id: 'p1',
    title: 'Soroban audit',
    description: '',
    category: 'Security',
    budget: 3000,
    token: 'USDC',
    status: 'in_progress',
    project_id_onchain: 7,
    freelancer_address: 'GC26DUXYW7PKP5N6WA5M5TRQQQTXDAB43IHPNWVLTH2TC4PUZ73CMIB5',
    milestones: [
      { id: 'm1', milestone_index: 0, title: 'Scope review', amount: 1000, status: 'submitted' },
      { id: 'm2', milestone_index: 1, title: 'Final report', amount: 1500, status: 'submitted' },
      { id: 'm3', milestone_index: 2, title: 'Approved work', amount: 700, status: 'approved' },
    ],
  },
];

describe('BulkMilestonePayoutManager (#308)', () => {
  beforeEach(() => {
    executeBulkPayout.mockReset();
  });

  it('lists only submitted milestones and starts with an empty selection', () => {
    render(
      <BulkMilestonePayoutManager
        isOpen
        onClose={() => {}}
        projects={projects}
        callerAddress="GCLIENT"
      />
    );

    expect(screen.getByTestId('bulk-selected-count').textContent).toBe('0');
    expect(screen.getByText(/Scope review/)).toBeInTheDocument();
    expect(screen.getByText(/Final report/)).toBeInTheDocument();
    expect(screen.queryByText(/Approved work/)).toBeNull();
  });

  it('recalculates the payout total as milestones are toggled', () => {
    render(
      <BulkMilestonePayoutManager
        isOpen
        onClose={() => {}}
        projects={projects}
        callerAddress="GCLIENT"
        balance={5000}
      />
    );

    fireEvent.click(screen.getByTestId('bulk-select-p1:0'));
    expect(screen.getByTestId('bulk-selected-count').textContent).toBe('1');
    expect(screen.getByTestId('bulk-payout-total').textContent).toContain('1,000');
    expect(screen.getByTestId('bulk-remaining-balance').textContent).toContain('4,000');

    fireEvent.click(screen.getByTestId('bulk-select-p1:1'));
    expect(screen.getByTestId('bulk-selected-count').textContent).toBe('2');
    expect(screen.getByTestId('bulk-payout-total').textContent).toContain('2,500');
    expect(screen.getByTestId('bulk-remaining-balance').textContent).toContain('2,500');

    fireEvent.click(screen.getByTestId('bulk-select-p1:0'));
    expect(screen.getByTestId('bulk-selected-count').textContent).toBe('1');
    expect(screen.getByTestId('bulk-payout-total').textContent).toContain('1,500');
  });

  it('Select All selects every visible milestone and Clear All deselects them', () => {
    render(
      <BulkMilestonePayoutManager
        isOpen
        onClose={() => {}}
        projects={projects}
        callerAddress="GCLIENT"
      />
    );

    fireEvent.click(screen.getByTestId('bulk-select-all'));
    expect(screen.getByTestId('bulk-selected-count').textContent).toBe('2');

    fireEvent.click(screen.getByTestId('bulk-select-all'));
    expect(screen.getByTestId('bulk-selected-count').textContent).toBe('0');
  });

  it('executes one batch and renders the completion receipt', async () => {
    executeBulkPayout.mockImplementation(async ({ milestones, onProgress }) => {
      onProgress?.(70, 'submitting', 'Broadcasting batch…');
      onProgress?.(100, 'success', 'Confirmed');
      return {
        success: true,
        txHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        approvedCount: milestones.length,
        totals: { count: 2, payoutTotal: 2500, token: 'USDC', networkFeeStroops: 200, networkFeeXlm: 0.00002, remainingBalance: null, exceedsBalance: false },
      };
    });

    render(
      <BulkMilestonePayoutManager
        isOpen
        onClose={() => {}}
        projects={projects}
        callerAddress="GCLIENT"
      />
    );

    fireEvent.click(screen.getByTestId('bulk-select-all'));
    fireEvent.click(screen.getByTestId('bulk-execute'));

    await waitFor(() => expect(executeBulkPayout).toHaveBeenCalledTimes(1));
    expect(executeBulkPayout.mock.calls[0][0].milestones).toHaveLength(2);
    expect(await screen.findByTestId('bulk-payout-receipt')).toHaveTextContent(
      'Batch complete · 2 milestone(s) released'
    );
    expect(
      screen.getByRole('link', { name: /view tx on stellar expert/i }).getAttribute('href')
    ).toContain('deadbeef');
  });
});
