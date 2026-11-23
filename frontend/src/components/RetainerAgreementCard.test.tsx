import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RetainerAgreementCard, RetainerAgreementForm } from './RetainerAgreementCard';
import type { RetainerConfig } from '@/types';

const agreement: RetainerConfig = {
  frequency: 'monthly',
  cycles: 3,
  amountPerCycle: 1500,
  startDate: '2026-01-31',
  token: 'USDC',
  status: 'active',
  completedCycles: 0,
};

const now = '2026-02-15';

describe('RetainerAgreementCard', () => {
  it('shows frequency, total obligation, next funding date, and schedule', () => {
    render(<RetainerAgreementCard agreement={agreement} now={now} />);

    expect(screen.getAllByText('1,500.00 USDC').length).toBeGreaterThan(0);
    expect(screen.getByTestId('retainer-total')).toHaveTextContent('4,500.00 USDC');
    expect(screen.getByTestId('retainer-next-funding')).toHaveTextContent('Feb 28, 2026');
    expect(screen.getByTestId('retainer-schedule')).toHaveTextContent('Jan 31, 2026');
    expect(screen.getByTestId('retainer-completed')).toHaveTextContent('0 / 3');
  });

  it('enables renewal only after every cycle completes', () => {
    const onRenew = vi.fn();
    const { rerender } = render(
      <RetainerAgreementCard agreement={agreement} now={now} onRenew={onRenew} />
    );

    expect(screen.getByTestId('retainer-renew')).toBeDisabled();

    rerender(
      <RetainerAgreementCard
        agreement={{ ...agreement, completedCycles: 3, status: 'completed' }}
        now={now}
        onRenew={onRenew}
      />
    );
    expect(screen.getByTestId('retainer-renew')).toBeEnabled();
    fireEvent.click(screen.getByTestId('retainer-renew'));
    expect(onRenew).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 'monthly', cycles: 3, completedCycles: 3 })
    );
  });

  it('requires confirmation and applies a 7-day termination notice', async () => {
    const onTerminate = vi.fn();
    render(<RetainerAgreementCard agreement={agreement} now={now} onTerminate={onTerminate} />);

    const terminate = screen.getByTestId('retainer-terminate');
    fireEvent.click(terminate);
    expect(onTerminate).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm termination')).toBeInTheDocument();

    fireEvent.click(terminate);
    await waitFor(() => expect(onTerminate).toHaveBeenCalledTimes(1));
    expect(onTerminate).toHaveBeenCalledWith(
      '2026-02-22',
      expect.objectContaining({ frequency: 'monthly' })
    );
  });
});

describe('RetainerAgreementForm', () => {
  it('validates cycle inputs before submitting', async () => {
    const onSubmit = vi.fn();
    render(<RetainerAgreementForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('retainer-cycles'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('retainer-amount'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: /create retainer/i }));

    expect(await screen.findByTestId('retainer-cycles-error')).toHaveTextContent(
      'At least one funding cycle is required'
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid retainer configuration', async () => {
    const onSubmit = vi.fn();
    render(<RetainerAgreementForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('retainer-frequency'), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByTestId('retainer-cycles'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('retainer-amount'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: /create retainer/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        frequency: 'weekly',
        cycles: 4,
        amountPerCycle: 250,
        token: 'USDC',
      })
    );
  });

  it('shows the total contract obligation live', () => {
    render(<RetainerAgreementForm onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByTestId('retainer-cycles'), { target: { value: '6' } });
    fireEvent.change(screen.getByTestId('retainer-amount'), { target: { value: '1000' } });

    expect(screen.getByTestId('retainer-form-total')).toHaveTextContent('6,000.00 USDC');
  });
});
