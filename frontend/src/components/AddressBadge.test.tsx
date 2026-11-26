import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { AddressBadge } from './AddressBadge';
import { soundSynthesizer } from '@/lib/sound-effects';

describe('address copy feedback', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ripples from the click and shows a checkmark for 1.5 seconds', async () => {
    vi.useFakeTimers();
    const playTick = vi.spyOn(soundSynthesizer, 'playCopyTick').mockResolvedValue();
    const { container } = render(<AddressBadge value="full-hash" label="Copy Transaction Hash" />);
    const button = screen.getByRole('button', { name: 'Copy Transaction Hash' });
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 32, 28));
    await act(async () => {
      fireEvent.click(button, { detail: 1, clientX: 17, clientY: 30 });
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('full-hash');
    expect(container.querySelector('.copy-ripple')).toHaveStyle({ left: '7px', top: '10px' });
    expect(container.querySelector('svg')).toHaveClass('text-emerald-400');
    expect(playTick).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(1499));
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('plays a short tone with Web Audio and honors the mute preference', async () => {
    const oscillator = { frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    const { SoundSynthesizer } = await import('@/lib/sound-effects');
    vi.stubGlobal('AudioContext', class {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator = () => oscillator;
      createGain = () => gain;
    });
    const synth = new SoundSynthesizer();
    try {
      await expect(synth.playCopyTick()).resolves.toBeUndefined();
      expect(oscillator.stop).toHaveBeenCalledWith(0.055);
      localStorage.setItem('notification_sounds_muted', 'true');
      await synth.playCopyTick();
      expect(oscillator.start).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
      localStorage.removeItem('notification_sounds_muted');
    }
  });
});

describe('AddressBadge Component', () => {
  const fullAddress = 'GAUBK6P5Z7I7ZXZZ6D7XQWJ7M2U3H7T5W7O6X7Y8Z9A1B2C3D4E5F6G7';

  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders truncated address correctly', () => {
    render(<AddressBadge address={fullAddress} truncateStart={4} truncateEnd={4} />);
    expect(screen.getByText('GAUB...F6G7')).toBeInTheDocument();
  });

  it('copies full un-truncated address to clipboard and shows tooltip for 2000ms', async () => {
    render(<AddressBadge address={fullAddress} />);
    const copyButton = screen.getByTestId('address-copy-button');

    // Click to copy
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(fullAddress);
    expect(screen.getByTestId('copy-tooltip')).toBeInTheDocument();
    expect(screen.getByText('Copied to Clipboard!')).toBeInTheDocument();

    // Advance 1999ms -> tooltip still visible
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByTestId('copy-tooltip')).toBeInTheDocument();

    // Advance to 2000ms -> tooltip disappears
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('copy-tooltip')).not.toBeInTheDocument();
  });

  it('renders Stellar Expert link opening in new tab', () => {
    render(<AddressBadge address={fullAddress} network="testnet" showExplorerLink={true} />);
    const link = screen.getByTestId('stellar-expert-link');

    expect(link).toHaveAttribute(
      'href',
      `https://stellar.expert/explorer/testnet/account/${fullAddress}`
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
