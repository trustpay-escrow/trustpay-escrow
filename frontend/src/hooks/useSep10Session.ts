'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useWalletStore } from '@/store/walletStore';
import { createSessionRefresher, refreshSessionToken } from '@/lib/sep10-auth';

/**
 * Keeps the SEP-0010 JWT alive for the connected wallet: restores it from the httpOnly cookie
 * after a reload (the token is never persisted) and refreshes it before it expires.
 */
export function useSep10Session() {
  const address = useWalletStore((s) => s.address);
  const token = useWalletStore((s) => s.token);

  useEffect(() => {
    if (!address || token) return;
    let cancelled = false;
    void refreshSessionToken(null).then((fresh) => {
      if (!cancelled && fresh) useWalletStore.getState().setToken(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, [address, token]);

  useEffect(() => {
    if (!address || !token) return;
    const refresher = createSessionRefresher({
      getToken: () => useWalletStore.getState().token,
      setToken: (fresh) => useWalletStore.getState().setToken(fresh),
      onExpired: () => {
        toast.error('Your session expired. Reconnect your wallet to sign a new SEP-0010 challenge.');
        useWalletStore.getState().disconnect();
      },
    });
    refresher.reschedule();
    return refresher.stop;
  }, [address, token]);
}
