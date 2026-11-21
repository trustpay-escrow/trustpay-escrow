import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AddressBadge } from './AddressBadge';
import { soundSynthesizer } from '@/lib/sound-effects';

describe('AddressBadge Component', () => {
  const TEST_ADDRESS = 'GAUBK6P5Z7I7ZXZZ6D7XQWJ7M2U3H7T5W7O6X7Y8Z9A1B2C3D4E5F6G7';
  const TEST_HASH = 'c3ee8701982bdf10c47d5b703a890123456789abcdef0123456789abcdef';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(soundSynthesizer, 'playTick').mockImplementation(() => {});
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the address with shared monospace styling', () => {
    render(<AddressBadge value={TEST_ADDRESS} />);
    const el = screen.getByText(TEST_ADDRESS);
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-crypto-id');
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
  });

  it('truncates address when head and tail are provided', () => {
    render(<AddressBadge value={TEST_ADDRESS} head={6} tail={4} />);
    expect(screen.getByText('GAUBK6...F6G7')).toBeInTheDocument();
  });

  it('applies expanding circular ripple animation class on click event', async () => {
    render(<AddressBadge value={TEST_HASH} />);
    const badge = screen.getByRole('button');

    expect(screen.queryByTestId('ripple-wave')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(badge, { clientX: 25, clientY: 15 });
    });

    const ripple = screen.getByTestId('ripple-wave');
    expect(ripple).toBeInTheDocument();
    expect(ripple).toHaveClass('animate-ripple', 'ripple');
  });

  it('triggers audio tick tone without throwing errors on click event', async () => {
    const playTickSpy = vi.spyOn(soundSynthesizer, 'playTick');

    render(<AddressBadge value={TEST_HASH} enableAudio={true} />);
    const badge = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(badge);
    });

    expect(playTickSpy).toHaveBeenCalledTimes(1);
  });

  it('does not play audio tone when enableAudio is false', async () => {
    const playTickSpy = vi.spyOn(soundSynthesizer, 'playTick');

    render(<AddressBadge value={TEST_HASH} enableAudio={false} />);
    const badge = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(badge);
    });

    expect(playTickSpy).not.toHaveBeenCalled();
  });

  it('transitions copy icon to green checkmark for 1.5 seconds then resets', async () => {
    vi.useFakeTimers();

    render(<AddressBadge value={TEST_ADDRESS} />);
    const badge = screen.getByRole('button');

    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('checkmark-icon')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(badge);
    });

    expect(screen.queryByTestId('copy-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkmark-icon')).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Address copied to clipboard');

    // Fast-forward 1.4s (still showing checkmark)
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(screen.getByTestId('checkmark-icon')).toBeInTheDocument();

    // Fast-forward past 1.5s
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('checkmark-icon')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('calls onCopy callback and writes to clipboard', async () => {
    const onCopyMock = vi.fn();
    render(<AddressBadge value={TEST_ADDRESS} onCopy={onCopyMock} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TEST_ADDRESS);
    expect(onCopyMock).toHaveBeenCalledWith(TEST_ADDRESS);
  });
});
