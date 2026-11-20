import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActiveRole = 'client' | 'freelancer';

interface WalletState {
  address: string | null;
  walletName: string | null;
  activeRole: ActiveRole;
  isClient: boolean;
  isFreelancer: boolean;
  token: string | null;
  isConnecting: boolean;
  setActiveRole: (role: ActiveRole) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setWalletInfo: (
    address: string,
    isClient?: boolean,
    isFreelancer?: boolean,
    walletName?: string,
    token?: string | null
  ) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      walletName: null,
      activeRole: 'client',
      isClient: true,
      isFreelancer: true,
      token: null,
      isConnecting: false,
      setActiveRole: (activeRole) => set({ activeRole }),
      setIsConnecting: (isConnecting) => set({ isConnecting }),
      setWalletInfo: (address, isClient = true, isFreelancer = true, walletName = 'Freighter', token = null) =>
        set({ address, isClient, isFreelancer, walletName, token, isConnecting: false }),
      disconnect: () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          fetch(`${apiUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        } catch {
          // ignore network error on logout
        }
        set({
          address: null,
          walletName: null,
          activeRole: 'client',
          isClient: true,
          isFreelancer: true,
          token: null,
          isConnecting: false,
        });
      },
    }),
    {
      name: 'trustpay-wallet-storage',
      partialize: (state) => ({
        address: state.address,
        walletName: state.walletName,
        activeRole: state.activeRole,
        isClient: state.isClient,
        isFreelancer: state.isFreelancer,
        token: state.token,
      }),
    }
  )
);
