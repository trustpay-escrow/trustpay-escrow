import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProposalCounterOfferModal, CounterOfferSummary } from './ProposalCounterOfferModal';
import { createCounterOffer, type MilestoneTerms } from '@/lib/counter-offer';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const originalMilestones: MilestoneTerms[] = [
  { milestone_index: 0, title: 'Design', amount: 1000, due_date: '2026-02-01' },
  { milestone_index: 1, title: 'Development', amount: 3000, due_date: '2026-03-01' },
];

const proposal = {
  id: 'prop-1',
  project_title: 'Escrow dashboard',
  budget: 4000,
};

describe('ProposalCounterOfferModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the original terms and a live counter-offer diff', () => {
    render(
      <ProposalCounterOfferModal
        isOpen
        proposal={proposal}
        originalMilestones={originalMilestones}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId('counter-offer-diff')).toBeInTheDocument();
    expect(screen.getByTestId('counter-original-total')).toHaveTextContent('4,000.00 USDC');

    fireEvent.change(screen.getByTestId('counter-amount-0'), { target: { value: '1200' } });
    fireEvent.change(screen.getByTestId('counter-amount-1'), { target: { value: '2800' } });

    expect(screen.getByTestId('counter-new-total')).toHaveTextContent('4,000.00 USDC');
    expect(screen.getByTestId('counter-diff-row-0')).toHaveTextContent('1,200.00 USDC');
    expect(screen.getByTestId('counter-diff-row-0')).toHaveTextContent('+200.00 USDC');
    expect(screen.getByTestId('counter-total-delta')).toHaveTextContent('No change');
  });

  it('shows the revised total when amounts change', () => {
    render(
      <ProposalCounterOfferModal
        isOpen
        proposal={proposal}
        originalMilestones={originalMilestones}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.change(screen.getByTestId('counter-amount-0'), { target: { value: '1500' } });
    fireEvent.change(screen.getByTestId('counter-amount-1'), { target: { value: '3500' } });

    expect(screen.getByTestId('counter-new-total')).toHaveTextContent('5,000.00 USDC');
    expect(screen.getByTestId('counter-total-delta')).toHaveTextContent('+1,000.00 USDC');
  });

  it('submits the counter-offer and emits a success toast', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <ProposalCounterOfferModal
        isOpen
        proposal={proposal}
        originalMilestones={originalMilestones}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByTestId('counter-amount-0'), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText(/negotiation note/i), {
      target: { value: 'Design expanded to cover the mobile dashboard.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send counter-offer/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        proposed_by: 'client',
        total: 4500,
        note: 'Design expanded to cover the mobile dashboard.',
      })
    );
    expect(toast.success).toHaveBeenCalledWith('Counter-offer sent to the freelancer');
    expect(onClose).toHaveBeenCalled();
  });

  it('rejects an invalid amount without submitting', async () => {
    const onSubmit = vi.fn();
    render(
      <ProposalCounterOfferModal
        isOpen
        proposal={proposal}
        originalMilestones={originalMilestones}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByTestId('counter-amount-0'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /send counter-offer/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Amount must be greater than 0');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('CounterOfferSummary', () => {
  const offer = createCounterOffer(
    [
      { milestone_index: 0, title: 'Design', amount: 1200, due_date: '2026-02-05' },
      { milestone_index: 1, title: 'Development', amount: 2800, due_date: '2026-03-01' },
    ],
    'client',
    'Adjusted for the expanded dashboard scope',
    '2026-01-15T10:00:00Z'
  );

  it('renders the incoming terms and delta versus the original budget', () => {
    render(
      <CounterOfferSummary
        offer={offer}
        originalBudget={4000}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />
    );

    expect(screen.getByText(/counter-offer from client/i)).toBeInTheDocument();
    expect(screen.getByTestId('counter-summary-total')).toHaveTextContent('4,000.00 USDC');
    expect(screen.getByText(/Adjusted for the expanded dashboard scope/)).toBeInTheDocument();
  });

  it('exposes one-click accept, decline, and re-counter actions', () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const onRecounter = vi.fn();
    render(
      <CounterOfferSummary
        offer={offer}
        originalBudget={4000}
        onAccept={onAccept}
        onDecline={onDecline}
        onRecounter={onRecounter}
      />
    );

    fireEvent.click(screen.getByTestId('counter-accept'));
    fireEvent.click(screen.getByTestId('counter-decline'));
    fireEvent.click(screen.getByTestId('counter-recounter'));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onRecounter).toHaveBeenCalledTimes(1);
  });
});
