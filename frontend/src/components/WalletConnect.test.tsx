import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import WalletConnect from './WalletConnect';
import * as freighterApi from '@stellar/freighter-api';
import { useWalletStore } from '@/store/walletStore';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock @stellar/freighter-api
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getNetworkDetails: vi.fn(),
  setAllowed: vi.fn(),
  signTransaction: vi.fn(),
}));

describe('WalletConnect Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWalletStore.setState({
      address: null,
      walletName: null,
      activeRole: 'client',
      isConnecting: false,
    });
  });

  it('renders initial connect button with normal icon and text', () => {
    render(<WalletConnect />);
    const button = screen.getByTestId('connect-freighter-button');
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(screen.getByText('Connect Freighter Wallet →')).toBeInTheDocument();
    expect(screen.queryByTestId('wallet-spinner')).not.toBeInTheDocument();
  });

  it('displays loading spinner, "Waiting for Wallet...", and disables button while connection is pending', async () => {
    // Create a deferred promise that stays pending
    let resolveAccess: any;
    const accessPromise = new Promise<{ address?: string; error?: string }>((resolve) => {
      resolveAccess = resolve;
    });

    vi.mocked(freighterApi.isConnected).mockResolvedValue(true as any);
    vi.mocked(freighterApi.getNetworkDetails).mockResolvedValue({ network: 'TESTNET' } as any);
    vi.mocked(freighterApi.setAllowed).mockResolvedValue(true as any);
    vi.mocked(freighterApi.requestAccess).mockImplementation(() => accessPromise);

    render(<WalletConnect />);
    const button = screen.getByTestId('connect-freighter-button');

    fireEvent.click(button);

    // Button should now be disabled and show the spinner + waiting text
    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(screen.getByTestId('wallet-spinner')).toBeInTheDocument();
      expect(screen.getByText('Waiting for Wallet...')).toBeInTheDocument();
    });

    // Resolve the access request
    resolveAccess({ error: 'User rejected the connection' });

    // After rejection, button should reset to normal state and be re-enabled
    await waitFor(() => {
      expect(button).not.toBeDisabled();
      expect(screen.queryByTestId('wallet-spinner')).not.toBeInTheDocument();
      expect(screen.getByText('Connect Freighter Wallet →')).toBeInTheDocument();
    });
  });

  it('resets button to normal state if connection throws an error', async () => {
    vi.mocked(freighterApi.isConnected).mockRejectedValue(new Error('Popup closed'));

    render(<WalletConnect />);
    const button = screen.getByTestId('connect-freighter-button');

    fireEvent.click(button);

    await waitFor(() => {
      expect(button).not.toBeDisabled();
      expect(screen.queryByTestId('wallet-spinner')).not.toBeInTheDocument();
      expect(screen.getByText('Connect Freighter Wallet →')).toBeInTheDocument();
    });
  });
});
