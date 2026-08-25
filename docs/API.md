# TrustPay Escrow — API & Contract Specification 📖

This document details the REST API endpoints served by the Express backend and the smart contract functions exposed by the Soroban Rust contract.

---

## 1. Express Backend REST API Reference

**Base URL:** `http://localhost:5000/api/v1` (Default local development)

### Headers
- `Content-Type: application/json`
- `x-stellar-pubkey: <Stellar Wallet Public Key>` (Authentication header for restricted endpoints)

---

### 1.1 Project Endpoints

#### `POST /projects`
Synchronize a newly created on-chain escrow project into the off-chain Supabase database.

**Request Body:**
```json
{
  "contractProjectId": 1,
  "title": "Fullstack Web3 Dashboard Development",
  "description": "Building a custom Soroban escrow management interface.",
  "clientAddress": "G...CLIENT",
  "freelancerAddress": "G...FREELANCER",
  "arbiterAddress": "G...ARBITER",
  "tokenAddress": "C...USDC",
  "totalAmount": "1000000000",
  "yieldEnabled": true,
  "milestones": [
    { "title": "Milestone 1: UI Mockups", "amount": "500000000" },
    { "title": "Milestone 2: Soroban Integration", "amount": "500000000" }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "projectId": "proj_987654321",
  "contractProjectId": 1,
  "status": "Active"
}
```

---

#### `GET /projects`
List projects filtered by wallet address or state.

**Query Parameters:**
- `role`: `client` | `freelancer` | `arbiter`
- `address`: `G...` (Stellar public key)
- `status`: `Active` | `Disputed` | `Completed`

**Response (200 OK):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "proj_987654321",
      "contractProjectId": 1,
      "title": "Fullstack Web3 Dashboard Development",
      "status": "Active",
      "totalAmount": "1000000000",
      "clientAddress": "G...CLIENT",
      "freelancerAddress": "G...FREELANCER"
    }
  ]
}
```

---

### 1.2 Proposal Endpoints

#### `POST /proposals`
Submit a proposal for an unassigned project space.

**Request Body:**
```json
{
  "projectId": "proj_987654321",
  "freelancerAddress": "G...FREELANCER",
  "coverNote": "I have 4 years of Soroban and Next.js development experience.",
  "estimatedDays": 14,
  "portfolioLinks": ["https://github.com/developer"]
}
```

---

### 1.3 Attachment & File Endpoints

#### `POST /attachments/upload`
Generate a presigned upload URL or upload file attachments for milestone deliverables.

**Request Body (Multipart Form-Data):**
- `file`: Binary file (PDF, PNG, JPG, ZIP - max 10MB)
- `projectId`: `proj_987654321`
- `milestoneIndex`: `0`

---

## 2. Soroban Smart Contract Interface (Rust / WASM)

**Contract Module:** `contracts/trustpay-escrow/src/lib.rs`

### 2.1 State-Changing Contract Functions

#### `create_project`
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
- **Description:** Transfers total milestone funds from `client` to contract address, computes principal liquidity splits, initializes state to `ProjectState::Active`, and returns unique `project_id` (u64).
- **Authentication:** `client.require_auth()` required.

---

#### `submit_milestone`
```rust
pub fn submit_milestone(
    env: Env,
    project_id: u64,
    milestone_index: u32,
)
```
- **Description:** Updates milestone state from `MilestoneState::Pending` to `MilestoneState::Submitted`.
- **Authentication:** `freelancer.require_auth()` required.

---

#### `approve_milestone`
```rust
pub fn approve_milestone(
    env: Env,
    project_id: u64,
    milestone_index: u32,
    rating: Option<u32>,
)
```
- **Description:** Transfers milestone token amount directly to `freelancer`. If all milestones are approved, project state transitions to `Completed` and yield is accrued.
- **Authentication:** `client.require_auth()` required.

---

#### `raise_dispute`
```rust
pub fn raise_dispute(
    env: Env,
    project_id: u64,
)
```
- **Description:** Transitions project state from `Active` to `Disputed`. Pauses further milestone payout requests.
- **Authentication:** `client.require_auth()` or `freelancer.require_auth()` required.

---

#### `resolve_dispute`
```rust
pub fn resolve_dispute(
    env: Env,
    project_id: u64,
    client_amount: i128,
    freelancer_amount: i128,
)
```
- **Description:** Settles remaining escrow balance between `client` and `freelancer` based on arbiter decision. Ensures `client_amount + freelancer_amount == remaining_balance`. Transitions state to `Completed`.
- **Authentication:** `arbiter.require_auth()` required.

---

### 2.2 Read-Only Query Functions

#### `get_project`
```rust
pub fn get_project(env: Env, project_id: u64) -> Project
```
- Returns complete `Project` struct (client, freelancer, arbiter, token, milestone array, state, yield parameters).
