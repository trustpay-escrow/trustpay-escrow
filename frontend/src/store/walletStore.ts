import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActiveRole = 'client' | 'freelancer';

interface WalletState {
  address: string | null;
  activeRole: ActiveRole;
  isClient: boolean;
  isFreelancer: boolean;
  setActiveRole: (role: ActiveRole) => void;
  setWalletInfo: (address: string, isClient?: boolean, isFreelancer?: boolean) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      activeRole: 'client',
      isClient: true,
      isFreelancer: true,
      setActiveRole: (activeRole) => set({ activeRole }),
      setWalletInfo: (address, isClient = true, isFreelancer = true) =>
        set({ address, isClient, isFreelancer }),
      disconnect: () => set({ address: null, activeRole: 'client', isClient: true, isFreelancer: true }),
    }),
    {
      name: 'trustpay-wallet-storage',
    }
  )
);
