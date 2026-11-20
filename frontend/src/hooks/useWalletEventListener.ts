'use client';

import { useEffect, useRef } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { toast } from 'sonner';

/**
 * Hook to listen for wallet account and network change events
 * Automatically disconnects and clears sensitive state when:
 * 1. User switches wallet accounts (e.g., in Freighter extension)
 * 2. User changes networks (e.g., Testnet -> Mainnet)
 * 3. User disconnects wallet entirely
 */
export function useWalletEventListener() {
  const { address, disconnect } = useWalletStore();
  const listeners = useRef<Array<{ event: string; handler: EventListener }>>([]);
  const lastAddressRef = useRef<string | null>(null);
  const lastNetworkRef = useRef<string | null>(null);

  useEffect(() => {
    if (!address) {
      lastAddressRef.current = null;
      return;
    }

    lastAddressRef.current = address;

    // Freighter Account Change Listener
    const handleFreighterAccountChange = async () => {
      try {
        const { requestAccess } = await import('@stellar/freighter-api');
        const response = await requestAccess();

        // User changed account or disconnected
        if (!response.address || response.address !== address) {
          toast.warning('Wallet account changed. Logging out for security.');
          disconnect();
        }
      } catch (error) {
        // Freighter extension error or unavailable
        toast.error('Wallet account changed. Logging out for security.');
        disconnect();
      }
    };

    // Freighter Network Change Listener
    const handleFreighterNetworkChange = async () => {
      try {
        const { getNetworkDetails } = await import('@stellar/freighter-api');
        const networkDetails = await getNetworkDetails();
        const currentNetwork = networkDetails.network;

        if (lastNetworkRef.current && lastNetworkRef.current !== currentNetwork) {
          toast.warning(`Network changed to ${currentNetwork}. Logging out for security.`);
          disconnect();
        }
        lastNetworkRef.current = currentNetwork;
      } catch (error) {
        // Network change event or unavailable
        toast.error('Wallet network changed. Logging out for security.');
        disconnect();
      }
    };

    // xBull Account Change Listener
    const handleXBullAccountChange = () => {
      if (typeof window !== 'undefined' && (window as any).xBullSDK) {
        const xBull = (window as any).xBullSDK;
        if (xBull.getPublicKey) {
          xBull
            .getPublicKey()
            .then((pubKey: string) => {
              if (!pubKey || pubKey !== address) {
                toast.warning('xBull wallet account changed. Logging out for security.');
                disconnect();
              }
            })
            .catch(() => {
              toast.error('xBull wallet disconnected. Logging out for security.');
              disconnect();
            });
        }
      }
    };

    // Generic Window Message Listener for wallet events
    const handleWalletMessage = (event: MessageEvent) => {
      // Handle Albedo or other wallet events
      if (event.data?.type === 'wallet:accountChanged') {
        toast.warning('Wallet account changed. Logging out for security.');
        disconnect();
      }

      if (event.data?.type === 'wallet:networkChanged') {
        toast.warning('Wallet network changed. Logging out for security.');
        disconnect();
      }

      if (event.data?.type === 'wallet:disconnected') {
        toast.info('Wallet disconnected.');
        disconnect();
      }
    };

    // Register listeners
    if (typeof window !== 'undefined') {
      // Freighter events
      window.addEventListener('freighterAccountChange', handleFreighterAccountChange);
      window.addEventListener('freighterNetworkChange', handleFreighterNetworkChange);

      // xBull events
      window.addEventListener('xBullAccountChange', handleXBullAccountChange);

      // Message-based events (Albedo, custom wallets)
      window.addEventListener('message', handleWalletMessage);

      // Store references for cleanup
      listeners.current = [
        { event: 'freighterAccountChange', handler: handleFreighterAccountChange },
        { event: 'freighterNetworkChange', handler: handleFreighterNetworkChange },
        { event: 'xBullAccountChange', handler: handleXBullAccountChange },
        { event: 'message', handler: handleWalletMessage },
      ];
    }

    // Cleanup listeners on unmount or address change
    return () => {
      listeners.current.forEach(({ event, handler }) => {
        if (typeof window !== 'undefined') {
          window.removeEventListener(event, handler);
        }
      });
      listeners.current = [];
    };
  }, [address, disconnect]);

  // Handle visibility change (page hidden/shown)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && address) {
        // Page became visible again - verify wallet still connected
        if (lastAddressRef.current !== address) {
          toast.warning('Wallet state changed while tab was hidden. Logging out for security.');
          disconnect();
        }
      }
    };

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    return undefined;
  }, [address, disconnect]);
}

export default useWalletEventListener;
