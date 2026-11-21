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

export interface OrgWalletAccount {
  id: string;
  label: string;
  address: string;
  walletName?: string;
  isPrimary?: boolean;
  addedAt: string;
}

export interface WalletState {
  address: string | null;
  walletName: string | null;
  activeRole: ActiveRole;
  isClient: boolean;
  isFreelancer: boolean;
  isArbiter: boolean;
  token: string | null;
  orgAccounts: OrgWalletAccount[];
  activeOrgAccountId: string | null;
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
  addOrgAccount: (account: { label: string; address: string; walletName?: string }) => void;
  removeOrgAccount: (id: string) => void;
  setActiveOrgAccount: (id: string | null) => void;
  disconnect: () => void;
}

function primaryOrgAccountId(address: string) {
  return `primary:${address}`;
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
      orgAccounts: [],
      activeOrgAccountId: null,
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
        set((state) => {
          const id = primaryOrgAccountId(address);
          const existing = state.orgAccounts.find((account) => account.id === id);
          const primaryAccount: OrgWalletAccount = {
            id,
            label: existing?.label || walletName || 'Primary Wallet',
            address,
            walletName,
            isPrimary: true,
            addedAt: existing?.addedAt || new Date().toISOString(),
          };
          const orgAccounts = existing
            ? state.orgAccounts.map((account) => (account.id === id ? primaryAccount : account))
            : [primaryAccount, ...state.orgAccounts];

          return {
            address,
            isClient,
            isFreelancer,
            isArbiter,
            walletName,
            token,
            orgAccounts,
            activeOrgAccountId: id,
          };
        });
      },
      addOrgAccount: ({ label, address, walletName }) =>
        set((state) => {
          const trimmedLabel = label.trim() || 'Organization wallet';
          const existing = state.orgAccounts.find(
            (account) => account.address.toUpperCase() === address.toUpperCase()
          );
          if (existing) {
            return {
              orgAccounts: state.orgAccounts.map((account) =>
                account.id === existing.id ? { ...account, label: trimmedLabel, walletName } : account
              ),
              activeOrgAccountId: existing.id,
            };
          }
          const account: OrgWalletAccount = {
            id: `org-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label: trimmedLabel,
            address,
            walletName,
            addedAt: new Date().toISOString(),
          };
          return { orgAccounts: [...state.orgAccounts, account], activeOrgAccountId: account.id };
        }),
      removeOrgAccount: (id) =>
        set((state) => ({
          orgAccounts: state.orgAccounts.filter((account) => account.id !== id),
          activeOrgAccountId: state.activeOrgAccountId === id ? null : state.activeOrgAccountId,
        })),
      setActiveOrgAccount: (activeOrgAccountId) => set({ activeOrgAccountId }),
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
          orgAccounts: [],
          activeOrgAccountId: null,
        });
      },
    }),
    {
      name: 'trustpay-wallet-storage',
      storage: createJSONStorage(getStorageProvider),
    }
  )
);

export function getActiveWalletAddress(state: WalletState): string | null {
  return state.orgAccounts.find((account) => account.id === state.activeOrgAccountId)?.address || state.address;
}

export function useActiveWalletAddress(): string | null {
  return useWalletStore((state) => getActiveWalletAddress(state));
}

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
