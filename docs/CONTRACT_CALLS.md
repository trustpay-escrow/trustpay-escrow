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
    Approved,
}

#[contracttype]
pub enum DataKey {
    Project(u64),
    ProjectCount,
}
```

### Structs

```rust
#[contracttype]
pub struct Milestone {
    pub amount: i128,
    pub state: MilestoneState,
}

#[contracttype]
pub struct Project {
    pub client: Address,
    pub freelancer: Address,
    pub arbiter: Address,
    pub token: Address,
    pub total_amount: i128,
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
Initializes a new milestone escrow project and locks the total funds into the contract.

- **Signature:**
  ```rust
  pub fn create_project(
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
- **Token Transfer:** Calls `token_client.transfer(&client, &contract_address, &total_amount)`.
- **Yield Split:** If `yield_enabled == true`, splits principal into 70% Blend yield allocation and 30% liquid reserve.
- **Returns:** Unique `project_id: u64`.

---

### 2. `submit_milestone`
Called by the freelancer upon completing deliverables for a specific milestone.

- **Signature:**
  ```rust
  pub fn submit_milestone(env: Env, project_id: u64, milestone_index: u32)
  ```
- **Authorization:** `project.freelancer.require_auth()`
- **Preconditions:**
  - `project.state == ProjectState::Active`
  - Milestone must be in `MilestoneState::Pending`
- **Effect:** Milestone state transitions to `MilestoneState::Submitted`.

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
- **Preconditions:** `project.state == ProjectState::Disputed`.
- **Effect:** Transfers allocated amounts to client and freelancer, resolves yield shares, and marks project `ProjectState::Completed`.
