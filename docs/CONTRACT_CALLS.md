# Soroban Smart Contract Specification & Call Map 📜

This document details the Soroban smart contract methods, data types, authorization checks, and invocation payloads for `contracts/trustpay-escrow`.

---

## Smart Contract Summary

- **Contract Name:** `TrustPayEscrow`
- **Language / Framework:** Rust, `soroban-sdk = "22.0.1"`
- **Target:** `wasm32-unknown-unknown`
- **State Storage:** Persistent storage using typed enum keys (`DataKey`).

---

## Data Structures & State Machine

### Enums

```rust
#[contracttype]
pub enum ProjectState {
    Active,
    Disputed,
    Completed,
}

#[contracttype]
pub enum MilestoneState {
    Pending,
    Submitted,
    InRevision,
    Approved,
}

#[contracttype]
pub enum DataKey {
    Project(u64),
    ProjectCount,
    Admin,
    Oracle,
}
```

### Structs

```rust
#[contracttype]
pub struct Milestone {
    pub amount: i128,
    pub state: MilestoneState,
    pub submitted_at: u64,
    pub deliverable_hash: Option<String>,
    pub revisions_remaining: u32,
}

#[contracttype]
pub struct Project {
    pub client: Address,
    pub freelancer: Option<Address>,
    pub arbiter: Address,
    pub token: Address,
    pub total_amount: i128,
    pub remaining_amount: i128,
    pub milestones: Vec<Milestone>,
    pub state: ProjectState,
    pub yield_enabled: bool,
    pub principal_liquid: i128,
    pub principal_blend: i128,
    pub accrued_yield: i128,
}
```

---

## Contract Method Invocations

### 1. `create_project`
Initializes a new milestone escrow project and locks the total funds into the contract. Supports both assigned escrows and unassigned open job postings (Option B).

- **Signature:**
  ```rust
  pub fn create_project(
      env: Env,
      client: Address,
      freelancer: Option<Address>,
      arbiter: Address,
      token: Address,
      milestone_amounts: Vec<i128>,
      yield_enabled: bool,
  ) -> u64
  ```
- **Authorization:** `client.require_auth()`
- **Freelancer Parameter:** Pass `Some(freelancer)` when known upfront, or `None` to fund an open marketplace job posting before proposals arrive.
- **Token Transfer:** Calls `token_client.transfer(&client, &contract_address, &total_amount)`.
- **Yield Split:** If `yield_enabled == true`, splits principal into 70% Blend yield allocation and 30% liquid reserve.
- **Returns:** Unique `project_id: u64`.

---

### 1b. `lock_escrow` (Option A: Deposit on Award)
Atomic deposit-on-award helper: client drafts job posting off-chain, then locks milestone funds and binds the winning freelancer on-chain in one atomic transaction upon accepting proposal.

- **Signature:**
  ```rust
  pub fn lock_escrow(
      env: Env,
      client: Address,
      freelancer: Address,
      arbiter: Address,
      token: Address,
      milestone_amounts: Vec<i128>,
      yield_enabled: bool,
  ) -> u64
  ```
- **Authorization:** `client.require_auth()`

---

### 1c. `assign_freelancer` (Option B: Upfront Funded Marketplace)
Binds the winning freelancer to an unassigned escrow project previously funded upfront by the client.

- **Signature:**
  ```rust
  pub fn assign_freelancer(
      env: Env,
      project_id: u64,
      freelancer: Address,
  )
  ```
- **Authorization:** `project.client.require_auth()`
- **Preconditions:** `project.state == ProjectState::Active`, `project.freelancer.is_none()`.

---

### 1d. `cancel_unassigned_project` (Option B: Cancellation & Refund)
Cancels an unassigned escrow project and returns 100% of deposited escrow funds to the client.

- **Signature:**
  ```rust
  pub fn cancel_unassigned_project(env: Env, project_id: u64)
  ```
- **Authorization:** `project.client.require_auth()`
- **Preconditions:** `project.state == ProjectState::Active`, `project.freelancer.is_none()`.

---

### 2. `submit_milestone`
Called by the freelancer upon completing deliverables for a specific milestone. Stores cryptographic proof of work (IPFS CID or SHA-256 hash).

- **Signature:**
  ```rust
  pub fn submit_milestone(
      env: Env,
      project_id: u64,
      milestone_index: u32,
      deliverable_hash: String,
  )
  ```
- **Authorization:** `project.freelancer.require_auth()`
- **Preconditions:**
  - `project.state == ProjectState::Active`
  - Milestone must be in `MilestoneState::Pending` or `MilestoneState::InRevision`
  - `deliverable_hash.len() > 0`
- **Effect:**
  - Milestone state transitions to `MilestoneState::Submitted`.
  - Records `milestone.deliverable_hash = Some(deliverable_hash)`.
  - Sets `milestone.submitted_at = env.ledger().timestamp()`, starting the 7-day client review timelock.

---

### 2b. `request_revision`
Called by the client when submitted work requires revisions. Decrements remaining revisions and resets the timelock.

- **Signature:**
  ```rust
  pub fn request_revision(env: Env, project_id: u64, milestone_index: u32)
  ```
- **Authorization:** `project.client.require_auth()`
- **Preconditions:**
  - `project.state == ProjectState::Active`
  - `milestone.state == MilestoneState::Submitted`
  - `milestone.revisions_remaining > 0`
- **Effect:**
  - Decrements `milestone.revisions_remaining -= 1`.
  - Transitions milestone to `MilestoneState::InRevision`.
  - Resets `milestone.submitted_at = 0`, freezing the 7-day auto-release timer until the freelancer resubmits updated work.

---

### 2c. `set_milestone_revision_limit`
Allows the client to adjust the maximum revision allowance for a milestone prior to submission.

- **Signature:**
  ```rust
  pub fn set_milestone_revision_limit(
      env: Env,
      project_id: u64,
      milestone_index: u32,
      revision_limit: u32,
  )
  ```
- **Authorization:** `project.client.require_auth()`

---

### 3. `approve_milestone`
Called by the client to approve completed milestone work and release payment.

- **Signature:**
  ```rust
  pub fn approve_milestone(
      env: Env,
      project_id: u64,
      milestone_index: u32,
      platform: Option<Address>,
  )
  ```
- **Authorization:** `project.client.require_auth()`
- **Preconditions:**
  - `milestone.state == MilestoneState::Submitted`
- **Effect:**
  - Milestone state transitions to `MilestoneState::Approved`.
  - Transfers milestone funds: `token_client.transfer(&contract_address, &project.freelancer, &milestone.amount)`.
  - If all milestones are approved, project transitions to `ProjectState::Completed` and distributes accrued yield (70% Client, 30% Platform).

---

---

### 3b. `auto_release_milestone`
Self-executing on-chain auto-release once the 7-day review timelock has elapsed.

- **Signature:**
  ```rust
  pub fn auto_release_milestone(
      env: Env,
      project_id: u64,
      milestone_index: u32,
      platform: Option<Address>,
  )
  ```
- **Authorization:** None required for client (callable by freelancer, platform relayer, or any caller).
- **Preconditions:**
  - `project.state == ProjectState::Active`
  - `milestone.state == MilestoneState::Submitted`
  - `env.ledger().timestamp() >= milestone.submitted_at + 7 * 24 * 60 * 60` (604,800 seconds / 7 days)
- **Effect:**
  - Releases milestone funds without requiring `client.require_auth()`: `token_client.transfer(&contract_address, &project.freelancer, &milestone.amount)`.
  - Transitions milestone to `MilestoneState::Approved`.
  - If all milestones complete, settles final project state and yield distribution.

---

### 4. `raise_dispute`
Transitions an active project into arbitration if expectations or deliverables are contested.

- **Signature:**
  ```rust
  pub fn raise_dispute(env: Env, caller: Address, project_id: u64)
  ```
- **Authorization:** `caller.require_auth()` (Caller must be either `client` or `freelancer`).
- **Effect:** Project state transitions to `ProjectState::Disputed`. Funds remain locked until arbiter settlement.

---

### 5. `resolve_dispute`
Executed by the designated arbiter to distribute disputed funds according to verdict.

- **Signature:**
  ```rust
  pub fn resolve_dispute(
      env: Env,
      project_id: u64,
      client_amount: i128,
      freelancer_amount: i128,
      platform: Option<Address>,
  )
  ```
- **Authorization:** `project.arbiter.require_auth()`
- **Preconditions:**
  - `project.state == ProjectState::Disputed`
  - `client_amount >= 0` and `freelancer_amount >= 0`
  - **Balance Invariant Guard:** `client_amount + freelancer_amount <= project.remaining_amount` (Strictly prevents rogue arbiters or input typos from draining other projects or contract reserves).
- **Effect:**
  - Deducts `client_amount + freelancer_amount` from `project.remaining_amount`.
  - Transfers allocated amounts to client and freelancer.
  - Resolves yield shares (70% Client, 30% Platform).
  - Transitions project state to `ProjectState::Completed`.

---

### 6. `accrue_yield`
Called by an authorized oracle, admin, or the project arbiter to accrue interest earned on liquidity.

- **Signature:**
  ```rust
  pub fn accrue_yield(
      env: Env,
      caller: Address,
      project_id: u64,
      yield_amount: i128,
  )
  ```
- **Authorization:** `caller.require_auth()` (Caller must be registered `Oracle`, `Admin`, or project `Arbiter`).
- **Preconditions:**
  - `yield_amount > 0`
  - `project.yield_enabled == true`
  - `project.state == ProjectState::Active` or `ProjectState::Disputed`
- **Effect:** Increments `project.accrued_yield` by `yield_amount`.

---

### 7. Admin & Oracle Management
Configures platform-level administrative and oracle contracts.

- `initialize(env: Env, admin: Address, oracle: Option<Address>)`: Sets the contract administrator and initial oracle (can only be run once).
- `set_admin(env: Env, new_admin: Address)`: Transfers administrator privileges (requires current admin authorization).
- `set_oracle(env: Env, oracle: Address)`: Updates authorized price/yield oracle (requires admin authorization).
- `get_admin(env: Env) -> Option<Address>`: Read-only query for current admin.
- `get_oracle(env: Env) -> Option<Address>`: Read-only query for current oracle.

---

## Contract Events Index (Ledger-to-Database Sync) 📡

To guarantee complete data integrity and prevent frontend desynchronization, the contract emits structured Soroban events across all state-changing operations via `env.events().publish(...)`.

The backend event indexer service (`backend/src/services/indexer.service.ts`) subscribes to these events via `SorobanRpc.Server.getEvents()` and idempotently synchronizes the platform database (`projects`, `milestones`, `notifications`, `indexer_state`).

### Event Topics and Data Payloads

| Event Topic | Topics Tuple | Data Payload | Trigger Condition |
| :--- | :--- | :--- | :--- |
| `project.created` | `(symbol_short!("project"), symbol_short!("created"))` | `(project_id: u64, client: Address, total_amount: i128)` | Client initializes escrow contract and locks funds |
| `project.assigned` | `(symbol_short!("project"), symbol_short!("assigned"))` | `(project_id: u64, freelancer: Address)` | Client accepts a proposal and binds freelancer |
| `project.cancelled` | `(symbol_short!("project"), symbol_short!("cancelled"))` | `(project_id: u64, refund_amount: i128)` | Client cancels unassigned job posting and receives refund |
| `project.disputed` | `(symbol_short!("project"), symbol_short!("disputed"))` | `(project_id: u64, caller: Address)` | Client or freelancer freezes contract and raises dispute |
| `project.resolved` | `(symbol_short!("project"), symbol_short!("resolved"))` | `(project_id: u64, client_amount: i128, freelancer_amount: i128)` | Arbiter executes split resolution under balance invariant guard |
| `milestone.submitted` | `(symbol_short!("milestone"), symbol_short!("submitted"))` | `(project_id: u64, milestone_index: u32, submitted_at: u64)` | Freelancer submits milestone deliverable hash |
| `milestone.revision` | `(symbol_short!("milestone"), symbol_short!("revision"))` | `(project_id: u64, milestone_index: u32, revisions_remaining: u32)` | Client requests formal revision (decrements revision limit, resets timelock) |
| `milestone.approved` | `(symbol_short!("milestone"), symbol_short!("approved"))` | `(project_id: u64, milestone_index: u32)` | Client approves milestone and releases payment |
| `milestone.auto_rel` | `(symbol_short!("milestone"), symbol_short!("auto_rel"))` | `(project_id: u64, milestone_index: u32)` | 7-day timelock expires without dispute, milestone auto-releases on-chain |
| `yield.accrued` | `(symbol_short!("yield"), symbol_short!("accrued"))` | `(project_id: u64, yield_amount: i128)` | Oracle/admin registers earned liquidity yield |

### Indexer Architecture & Deduplication
- **Deduplication:** Events are hashed by `(eventId, txHash)` and tracked in PostgreSQL (`processed_events` table) and in an in-memory LRU cache.
- **Starting Ledger Cursor:** Persisted in `indexer_state` table to ensure zero missed events across backend restarts or re-deployments.
- **Cache Invalidation:** Triggers Redis/in-memory cache purges (`/api/projects*`, `/api/milestones*`) so users and dashboards receive real-time updates.
