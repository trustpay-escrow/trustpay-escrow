import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'client' | 'freelancer' | null;

interface WalletState {
  address: string | null;
  role: Role;
  setWalletInfo: (address: string, role: Role) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      role: null,
      setWalletInfo: (address, role) => set({ address, role }),
      disconnect: () => set({ address: null, role: null }),
    }),
    {
      name: 'trustpay-wallet-storage', // name of the item in the storage (must be unique)
    }
  )
);
