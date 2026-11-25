import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionSpeedUpModal } from '@/components/TransactionSpeedUpModal';

describe('TransactionSpeedUpModal', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals the speed-up action after a transaction has been pending for 15 seconds', async () => {
    vi.useFakeTimers();
    render(
      <TransactionSpeedUpModal
        pendingTransaction={{
          xdr: 'inner-xdr',
          hash: 'transaction-hash',
          submittedAt: Date.now(),
        }}
        feeSource="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
        onIncluded={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Speed Up Transaction' })).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Speed Up Transaction' }));
    expect(screen.getByRole('dialog', { name: 'Speed Up Transaction' })).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });
});
