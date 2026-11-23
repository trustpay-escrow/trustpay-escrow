import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NetworkMismatchBanner, normalizeNetwork, isNetworkMismatch } from './NetworkMismatchBanner';
import { useWalletStore } from '@/store/walletStore';

describe('normalizeNetwork and isNetworkMismatch helpers', () => {
  it('normalizes various network strings correctly', () => {
    expect(normalizeNetwork('PUBLIC')).toBe('MAINNET');
    expect(normalizeNetwork('Stellar Public Mainnet')).toBe('MAINNET');
    expect(normalizeNetwork('TESTNET')).toBe('TESTNET');
    expect(normalizeNetwork('Testnet')).toBe('TESTNET');
    expect(normalizeNetwork('FUTURENET')).toBe('FUTURENET');
    expect(normalizeNetwork('')).toBe('');
    expect(normalizeNetwork(null)).toBe('');
  });

  it('correctly detects network mismatches', () => {
    expect(isNetworkMismatch('PUBLIC', 'TESTNET')).toBe(true);
    expect(isNetworkMismatch('MAINNET', 'TESTNET')).toBe(true);
    expect(isNetworkMismatch('FUTURENET', 'TESTNET')).toBe(true);
    expect(isNetworkMismatch('TESTNET', 'TESTNET')).toBe(false);
    expect(isNetworkMismatch(null, 'TESTNET')).toBe(false);
  });
});

describe('NetworkMismatchBanner Component', () => {
  beforeEach(() => {
    useWalletStore.setState({
      address: null,
      network: null,
      targetNetwork: 'TESTNET',
    });
  });

  it('renders nothing when wallet is not connected', () => {
    const { container } = render(<NetworkMismatchBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when network matches targetNetwork', () => {
    useWalletStore.setState({
      address: 'GBB...123',
      network: 'TESTNET',
      targetNetwork: 'TESTNET',
    });

    const { container } = render(<NetworkMismatchBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders warning banner when connected to Mainnet while target is Testnet', () => {
    useWalletStore.setState({
      address: 'GBB...123',
      network: 'PUBLIC',
      targetNetwork: 'TESTNET',
    });

    render(<NetworkMismatchBanner />);

    const banner = screen.getByTestId('network-mismatch-banner');
    expect(banner).toBeDefined();
    expect(screen.getByText(/You are connected to Stellar Mainnet. Please switch to Testnet./i)).toBeDefined();
  });

  it('updates store network when Switch Network button is clicked', () => {
    useWalletStore.setState({
      address: 'GBB...123',
      network: 'MAINNET',
      targetNetwork: 'TESTNET',
    });

    render(<NetworkMismatchBanner />);

    const switchBtn = screen.getByRole('button', { name: /switch network/i });
    fireEvent.click(switchBtn);

    expect(useWalletStore.getState().network).toBe('TESTNET');
  });
});
