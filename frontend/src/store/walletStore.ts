import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Safe storage resolver that handles browser localStorage and falls back gracefully in tests/SSR
const getStorageProvider = () => {
  if (
    typeof window !== 'undefined' &&
    window.localStorage &&
    typeof window.localStorage.setItem === 'function'
  ) {
    return window.localStorage;
  }
  const memoryStore: Record<string, string> = {};
  return {
    getItem: (key: string) => memoryStore[key] ?? null,
    setItem: (key: string, value: string) => {
      memoryStore[key] = String(value);
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    },
    clear: () => {
      Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
    },
    length: 0,
    key: (i: number) => Object.keys(memoryStore)[i] ?? null,
  };
};

export type ActiveRole = 'client' | 'freelancer' | 'arbiter';

export interface RoleFilterState {
  status?: string;
  search?: string;
  category?: string;
}

export interface WalletState {
  address: string | null;
  walletName: string | null;
  activeRole: ActiveRole;
  isClient: boolean;
  isFreelancer: boolean;
  isArbiter: boolean;
  token: string | null;
  roleFilterStates: Record<ActiveRole, RoleFilterState>;
  setActiveRole: (role: ActiveRole) => void;
  setRoleFilter: (role: ActiveRole, filters: Partial<RoleFilterState>) => void;
  setWalletInfo: (
    address: string,
    isClient?: boolean,
    isFreelancer?: boolean,
    walletNameOrArbiter?: string | boolean,
    token?: string | null,
    isArbiter?: boolean
  ) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      walletName: null,
      activeRole: 'client',
      isClient: true,
      isFreelancer: true,
      isArbiter: true,
      token: null,
      roleFilterStates: {
        client: { status: 'all', search: '', category: 'All' },
        freelancer: { status: 'all', search: '', category: 'All' },
        arbiter: { status: 'disputed', search: '', category: 'All' },
      },
      setActiveRole: (activeRole) => set({ activeRole }),
      setRoleFilter: (role, filters) =>
        set((state) => ({
          roleFilterStates: {
            ...state.roleFilterStates,
            [role]: { ...state.roleFilterStates[role], ...filters },
          },
        })),
      setWalletInfo: (
        address,
        isClient = true,
        isFreelancer = true,
        walletNameOrArbiter = 'Freighter',
        token = null,
        isArbiterParam = true
      ) => {
        let walletName = 'Freighter';
        let isArbiter = true;
        if (typeof walletNameOrArbiter === 'string') {
          walletName = walletNameOrArbiter;
          isArbiter = isArbiterParam;
        } else if (typeof walletNameOrArbiter === 'boolean') {
          isArbiter = walletNameOrArbiter;
        }
        set({ address, isClient, isFreelancer, isArbiter, walletName, token });
      },
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
          isArbiter: true,
          token: null,
        });
      },
    }),
    {
      name: 'trustpay-wallet-storage',
      storage: createJSONStorage(getStorageProvider),
    }
  )
);

/**
 * Permission Selector: Prevents clients from accidentally submitting proposals to their own escrows.
 */
export function canSubmitProposal(
  project: { client?: string; client_address?: string; id?: string } | null,
  userAddress: string | null,
  activeRole: ActiveRole
): { allowed: boolean; reason?: string } {
  if (!userAddress) {
    return { allowed: false, reason: 'Please connect your Freighter wallet first.' };
  }
  if (activeRole !== 'freelancer') {
    return {
      allowed: false,
      reason: 'You must be in Freelancer mode to submit proposals to an escrow.',
    };
  }
  if (!project) {
    return { allowed: false, reason: 'No project selected.' };
  }

  const clientAddress = (project.client_address || project.client || '').toLowerCase();
  const normalizedUser = userAddress.toLowerCase();

  if (clientAddress && clientAddress === normalizedUser) {
    return {
      allowed: false,
      reason: 'Permission Denied: You cannot submit proposals to your own escrow project.',
    };
  }

  return { allowed: true };
}

/**
 * Permission Selector: Verifies whether the active role allows escrow creation.
 */
export function canCreateProject(activeRole: ActiveRole): boolean {
  return activeRole === 'client';
}

/**
 * Permission Selector: Verifies whether the active wallet can approve milestones.
 */
export function canApproveMilestone(
  project: { client?: string; client_address?: string } | null,
  userAddress: string | null,
  activeRole: ActiveRole
): boolean {
  if (!project || !userAddress || activeRole !== 'client') return false;
  const clientAddr = (project.client_address || project.client || '').toLowerCase();
  return clientAddr === userAddress.toLowerCase();
}

/**
 * Permission Selector: Verifies whether the active wallet can submit milestones.
 */
export function canSubmitMilestone(
  project: { freelancer?: string; freelancer_address?: string } | null,
  userAddress: string | null,
  activeRole: ActiveRole
): boolean {
  if (!project || !userAddress || activeRole !== 'freelancer') return false;
  const fAddr = (project.freelancer_address || project.freelancer || '').toLowerCase();
  return fAddr === userAddress.toLowerCase();
}

/**
 * Permission Selector: Verifies whether the active role and address can resolve disputes.
 */
export function canResolveDispute(
  project: { arbiter?: string; arbiter_address?: string } | null,
  userAddress: string | null,
  activeRole: ActiveRole
): boolean {
  if (!userAddress || activeRole !== 'arbiter') return false;
  if (!project) return true;
  const arbiterAddr = (project.arbiter_address || project.arbiter || '').toLowerCase();
  if (!arbiterAddr) return true;
  return arbiterAddr === userAddress.toLowerCase();
}

/**
 * Permission Selector: Verifies whether caller is party to the project and can raise a dispute.
 */
export function canRaiseDispute(
  project: { client?: string; client_address?: string; freelancer?: string; freelancer_address?: string } | null,
  userAddress: string | null
): boolean {
  if (!project || !userAddress) return false;
  const normalized = userAddress.toLowerCase();
  const clientAddr = (project.client_address || project.client || '').toLowerCase();
  const fAddr = (project.freelancer_address || project.freelancer || '').toLowerCase();
  return normalized === clientAddr || normalized === fAddr;
}
