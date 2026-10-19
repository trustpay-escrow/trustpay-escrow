# State Management & Wallet Lifecycle Architecture 🌐

This document outlines the state architecture, wallet connection lifecycle, and synchronization layers powering TrustPay Escrow.

---

## High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Stellar Blockchain                   │
│   (Freighter Wallet / Soroban RPC / Escrow Contract)   │
└───────────────────────────▲────────────────────────────┘
                            │ On-Chain Signatures & Events
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Client Global State                    │
│            (Zustand `useWalletStore`)                  │
│   - address: string | null                             │
│   - network: string                                    │
│   - isConnected: boolean                               │
│   - activeRole: 'client' | 'freelancer'                │
└───────────────────────────▲────────────────────────────┘
                            │ Optimistic Updates & Sync
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Backend REST API                     │
│               (Express / Supabase PostgreSQL)          │
│   - Users & Roles mapping                              │
│   - Off-chain project & proposal metadata              │
│   - Attachments & activity notifications               │
└────────────────────────────────────────────────────────┘
```

---

## 1. Wallet Lifecycle (Freighter SDK)

The frontend integrates with `@stellar/freighter-api` to maintain non-custodial interaction:

1. **Detection:** When the application loads, `isConnected()` checks whether the Freighter extension is active.
2. **Access Authorization:** Upon user action, `requestAccess()` prompts the user to grant public key read access.
3. **Network Guard:** `getNetworkDetails()` verifies that the wallet is pointed to the configured network (Stellar Testnet or Mainnet). If mismatched, a toast notification guides the user to change network in Freighter settings.
4. **Account Switch Listener:** When the active keypair changes in Freighter, the global store updates immediately without requiring a full page refresh.

---

## 2. Global State (`useWalletStore`)

The state is managed using **Zustand** with persistent storage:

```typescript
interface WalletState {
  address: string | null;
  network: string | null;
  isConnected: boolean;
  activeRole: 'client' | 'freelancer';
  setAddress: (address: string | null) => void;
  setNetwork: (network: string | null) => void;
  setConnected: (connected: boolean) => void;
  setActiveRole: (role: 'client' | 'freelancer') => void;
  disconnect: () => void;
}
```

### Single-Identity Multi-Role Model
A single Stellar wallet address can participate both as a **Client** (funding escrows) and as a **Freelancer** (submitting work). The UI provides a role switcher that toggles active views while retaining the underlying authenticated wallet identity.

---

## 3. Data Synchronization Strategy

1. **On-Chain Financial Invariants:** Total budget, locked milestone amounts, approval signatures, and yield distributions are verified strictly on-chain.
2. **Off-Chain Rich Metadata:** Project descriptions, task categories, proposal cover notes, and file attachments are stored in Supabase PostgreSQL and indexed via the Express backend.
3. **Optimistic Updates:** User actions (such as accepting an applicant or submitting a milestone) trigger immediate optimistic UI updates, followed by background confirmation.
