import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SupportedWalletId } from '@/lib/wallet-adapters';

export type ActiveRole = 'client' | 'freelancer';

interface WalletState {
  address: string | null;
  walletName: string | null;
  walletType: SupportedWalletId | null;
  activeRole: ActiveRole;
  isClient: boolean;
  isFreelancer: boolean;
  token: string | null;
  isConnecting: boolean;
  setIsConnecting: (isConnecting: boolean) => void;
  setActiveRole: (role: ActiveRole) => void;
  setWalletInfo: (
    address: string,
    isClient?: boolean,
    isFreelancer?: boolean,
    walletName?: string,
    token?: string | null,
    walletType?: SupportedWalletId | null
  ) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      walletName: null,
      walletType: null,
      activeRole: 'client',
      isClient: true,
      isFreelancer: true,
      token: null,
      isConnecting: false,
      setIsConnecting: (isConnecting) => set({ isConnecting }),
      setActiveRole: (activeRole) => set({ activeRole }),
      setWalletInfo: (
        address,
        isClient = true,
        isFreelancer = true,
        walletName = 'Freighter',
        token = null,
        walletType = 'freighter'
      ) =>
        set({ address, isClient, isFreelancer, walletName, token, walletType }),
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
          walletType: null,
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
    }
  )
);
