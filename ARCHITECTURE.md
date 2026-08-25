# TrustPay Escrow — System Architecture & Technical Specification 🏗️

TrustPay Escrow is a decentralized payment infrastructure designed to remove payment counterparty risk in client-freelancer agreements on the **Stellar Blockchain** using **Soroban smart contracts**.

---

## 1. High-Level Architecture Overview

TrustPay Escrow utilizes a **Hybrid On-Chain / Off-Chain Architecture**:
- **On-Chain (Soroban Smart Contracts):** Financial custody, milestone state progression, multi-sig authorization, dispute enforcement, and protocol yield allocation.
- **Off-Chain (Express API Backend & Supabase):** High-speed metadata indexing, proposal application workflows, file attachment storage, real-time push notifications, and timelock auto-release cron monitoring.

```mermaid
graph TD
    UserClient[Client Wallet / App] -->|1. Sign & Create Escrow| SorobanContract[Soroban Escrow Contract]
    UserFreelancer[Freelancer Wallet / App] -->|2. Submit Milestone| SorobanContract
    Arbiter[Arbiter Wallet] -->|Dispute Resolution| SorobanContract

    UserClient -->|Project Specs / Attachments| NextFrontend[Next.js 14 Frontend UI]
    UserFreelancer -->|Submit Work & Links| NextFrontend
    NextFrontend -->|REST API & Auth Headers| ExpressBackend[Express API Backend]
    
    ExpressBackend -->|Sync / Cache State| SupabaseDB[(Supabase PostgreSQL)]
    ExpressBackend -->|Upload Deliverables| SupabaseStorage[Supabase Object Storage]
    ExpressBackend -->|Background Timelock Monitor| CronWorker[Cron Worker / Event Listener]
    CronWorker -->|Poll Ledger Events| SorobanRPC[Stellar Soroban RPC]
```

---

## 2. Soroban Smart Contract State Machine

The on-chain escrow contract manages projects through strict state transitions governed by cryptographic signatures:

```mermaid
stateDiagram-v2
    [*] --> Active: create_project() [Client Deposits USDC/XLM]
    Active --> Active: submit_milestone() [Freelancer Marks Milestone Submitted]
    Active --> Active: approve_milestone() [Client Approves & Contract Transfers Funds]
    Active --> Disputed: raise_dispute() [Client or Freelancer Initiates Dispute]
    Disputed --> Completed: resolve_dispute() [Arbiter Signs Fund Split]
    Active --> Completed: Final Milestone Approved
    Completed --> [*]
```

### State Enum Definitions (`contracts/trustpay-escrow/src/lib.rs`)

1. **`ProjectState`**:
   - `Active`: Initialized state; funds locked; milestone work and payouts in progress.
   - `Disputed`: Frozen state; milestone claims paused until assigned arbiter resolves.
   - `Completed`: All milestones approved or final dispute split resolved; funds fully settled.

2. **`MilestoneState`**:
   - `Pending`: Milestone active; freelancer working on deliverable.
   - `Submitted`: Freelancer completed work; awaiting client approval or dispute window.
   - `Approved`: Client confirmed deliverable; milestone amount transferred to freelancer address.

---

## 3. Data Ownership & Single Source of Truth Matrix

To ensure security without sacrificing off-chain performance, data responsibilities are strictly demarcated:

| Domain Data | Storage Location | Authority | Security Mechanism |
|---|---|---|---|
| **Escrow Principal Balance** | Soroban Contract Storage | **Authoritative (On-Chain)** | Cryptographic Stellar SAC transfers |
| **Milestone Status & Amounts** | Soroban Contract Storage | **Authoritative (On-Chain)** | `Address::require_auth()` guard |
| **Project & Milestone State** | Soroban Contract Storage | **Authoritative (On-Chain)** | Enforced state machine transitions |
| **Proposal Cover Letters & Quotes** | Supabase Postgres DB | **Authoritative (Off-Chain)** | Zod schema validation & RLS |
| **Deliverable File Attachments** | Supabase Storage Buckets | **Authoritative (Off-Chain)** | Signed URL tokens & size limits |
| **Activity Event History** | Supabase DB / Indexer | Read-Only Cache | Polled from Stellar RPC logs |

---

## 4. Operational Workflows & Sequence Diagrams

### 4.1 Complete Escrow & Milestone Payout Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant UI as Next.js Client
    participant RPC as Soroban RPC
    participant Contract as Soroban Escrow Contract
    actor Freelancer

    Client->>UI: Define Milestones & Select Arbiter
    UI->>RPC: Build create_project() transaction
    Client->>UI: Sign with Freighter Wallet
    UI->>Contract: Invoke create_project()
    Note over Contract: Locks total USDC/XLM in contract<br/>Calculates optional Blend yield split
    Contract-->>UI: Project ID Created (#1)

    Freelancer->>UI: Submit Deliverable & Proof Link
    UI->>Contract: Invoke submit_milestone(project_id, index)
    Note over Contract: Transitions milestone to Submitted

    Client->>UI: Review Deliverable & Click Approve
    UI->>Contract: Invoke approve_milestone(project_id, index)
    Contract->>Freelancer: Auto-transfer milestone USDC amount
    Note over Contract: If final milestone approved,<br/>transition state to Completed & distribute yield
```

### 4.2 Dispute Resolution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Disputer as Client / Freelancer
    participant UI as Next.js Client
    participant Contract as Soroban Escrow Contract
    actor Arbiter

    Disputer->>UI: Click "Raise Dispute"
    UI->>Contract: Invoke raise_dispute(project_id)
    Note over Contract: Sets project state to Disputed.<br/>Freezes milestone approvals.

    Arbiter->>UI: Review Evidence & Enter Split Amounts
    UI->>Contract: Invoke resolve_dispute(project_id, client_amt, freelancer_amt)
    Note over Contract: Verifies client_amt + freelancer_amt == remaining_balance.<br/>Requires Arbiter signature.<br/>Transfers funds to both parties.
    Contract-->>UI: Project State -> Completed
```

---

## 5. Yield Optimization Integration (Blend Protocol)

TrustPay Escrow supports optional capital efficiency via yield integration:
- **Principal Splitting:** When `yield_enabled = true` at project creation, 70% of locked escrow funds are deposited into liquid yield pools (e.g. Blend Lending Protocol on Stellar), while 30% remains in liquid reserve for early milestone payouts.
- **Yield Settlement:** Upon project completion, accumulated yield is accrued and divided between the client (70%) and platform reserve (30%), turning idle project capital into productive yield.

---

## 6. Technical Stack & Backend Module Architecture Taxonomy

- **Smart Contract Layer:** Rust, `soroban-sdk` v22.0.1, WebAssembly compilation (`wasm32-unknown-unknown`).
- **Backend API Service:** Express.js, Modular Feature Architecture (`modules/projects`, `modules/milestones`, `modules/proposals`, `modules/users`, `modules/notifications`, `modules/auto-release`, `shared/`), TypeScript 5, Node.js 20, Zod input validation, Winston logging.
- **Off-Chain Database & Storage:** Supabase (PostgreSQL), Supabase Object Storage, Row Level Security (RLS).
- **Frontend Client Application:** Next.js 14 (App Router), TypeScript, Tailwind CSS v4, `@stellar/freighter-api`, `@stellar/stellar-sdk`.
- **Infrastructure & Tools:** Docker, Docker Compose, GitHub Actions CI/CD, Soroban CLI.

