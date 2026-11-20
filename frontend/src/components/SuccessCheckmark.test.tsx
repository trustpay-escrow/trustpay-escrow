import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SuccessCheckmark } from './SuccessCheckmark';

describe('SuccessCheckmark Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SuccessCheckmark isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with milestone and amount details when isOpen is true', () => {
    render(
      <SuccessCheckmark
        isOpen={true}
        onClose={vi.fn()}
        milestoneIndex={0}
        milestoneTitle="Implement Soroban Escrow Contract"
        amount="500"
        tokenSymbol="USDC"
        recipientAddress="GAUBK6P5Z7I7ZXZZ6D7XQWJ7M2U3H7T5W7O6X7Y8Z9A1B2C3D4E5F6G7"
        txHash="0xabc123456789def"
        autoDismissDelay={0}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Milestone #1 Completed!')).toBeInTheDocument();
    expect(screen.getByText('Implement Soroban Escrow Contract')).toBeInTheDocument();
    expect(screen.getByText('500 USDC')).toBeInTheDocument();
    expect(screen.getByText('0xabc123456789def')).toBeInTheDocument();
    expect(screen.getByText('GAUBK6...E5F6G7')).toBeInTheDocument();

    for (const id of [screen.getByText('0xabc123456789def'), screen.getByText('GAUBK6...E5F6G7')]) {
      expect(id).toHaveAttribute('data-crypto-id');
      expect(id).toHaveClass('font-mono', 'tracking-tight', 'text-xs');
    }
    expect(screen.getByText('GAUBK6...E5F6G7')).toHaveAttribute(
      'title',
      'GAUBK6P5Z7I7ZXZZ6D7XQWJ7M2U3H7T5W7O6X7Y8Z9A1B2C3D4E5F6G7'
    );

    const svg = screen.getByTestId('checkmark-svg');
    expect(svg).toHaveClass('scale-100');
    expect(svg).toHaveClass('opacity-100');

    const path = screen.getByTestId('checkmark-path');
    expect(path).toHaveStyle({ strokeDashoffset: '0' });
  });

  it('calls onClose when Done button is clicked', () => {
    const onCloseMock = vi.fn();
    render(
      <SuccessCheckmark
        isOpen={true}
        onClose={onCloseMock}
        autoDismissDelay={0}
      />
    );

    const doneButton = screen.getByRole('button', { name: /done/i });
    fireEvent.click(doneButton);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onCloseMock = vi.fn();
    render(
      <SuccessCheckmark
        isOpen={true}
        onClose={onCloseMock}
        autoDismissDelay={0}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('calls onClose automatically after autoDismissDelay', () => {
    const onCloseMock = vi.fn();
    render(
      <SuccessCheckmark
        isOpen={true}
        onClose={onCloseMock}
        autoDismissDelay={3000}
      />
    );

    expect(onCloseMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
