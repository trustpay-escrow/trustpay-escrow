import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import AddressBadge from './AddressBadge';

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
