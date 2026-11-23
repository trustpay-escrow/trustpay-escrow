'use client';

import React from 'react';
import { useWalletStore } from '@/store/walletStore';

export function normalizeNetwork(network?: string | null): string {
  if (!network) return '';
  const upper = network.toUpperCase().trim();
  if (upper.includes('PUBLIC') || upper.includes('MAINNET')) return 'MAINNET';
  if (upper.includes('TESTNET')) return 'TESTNET';
  if (upper.includes('FUTURENET')) return 'FUTURENET';
  return upper;
}

export function isNetworkMismatch(currentNetwork?: string | null, targetNetwork?: string | null): boolean {
  if (!currentNetwork || !targetNetwork) return false;
  return normalizeNetwork(currentNetwork) !== normalizeNetwork(targetNetwork);
}

export function NetworkMismatchBanner() {
  const { address, network, targetNetwork, setNetwork } = useWalletStore();

  if (!address || !network || !targetNetwork) {
    return null;
  }

  const normalizedCurrent = normalizeNetwork(network);
  const normalizedTarget = normalizeNetwork(targetNetwork);

  if (normalizedCurrent === normalizedTarget) {
    return null;
  }

  const handleSwitchNetwork = async () => {
    try {
      // If Freighter API provides requestAccess or setNetworkDetails
      if (typeof window !== 'undefined' && (window as unknown as { freighter?: { setNetwork?: (net: string) => Promise<void> } }).freighter?.setNetwork) {
        await (window as unknown as { freighter: { setNetwork: (net: string) => Promise<void> } }).freighter.setNetwork(normalizedTarget);
      }
      setNetwork(normalizedTarget);
    } catch {
      // Fallback update store
      setNetwork(normalizedTarget);
    }
  };

  return (
    <div
      data-testid="network-mismatch-banner"
      role="alert"
      className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2.5 text-xs sm:text-sm font-medium flex flex-wrap items-center justify-between gap-3 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span>
          You are connected to Stellar {normalizedCurrent === 'MAINNET' ? 'Mainnet' : normalizedCurrent}. Please switch to {normalizedTarget === 'TESTNET' ? 'Testnet' : normalizedTarget}.
        </span>
      </div>

      <button
        onClick={handleSwitchNetwork}
        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-all shadow-sm active:scale-95"
      >
        Switch Network
      </button>
    </div>
  );
}
