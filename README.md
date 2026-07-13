# TrustPay Escrow

**Milestone-based escrow smart contract on Stellar (Soroban) — funds lock on-chain and release automatically as work is approved.**

TrustPay Escrow solves a trust problem that every freelance/client relationship runs into: a client shouldn't have to pay everything upfront and hope for delivery, and a freelancer shouldn't have to deliver everything upfront and hope to get paid. Instead, funds are locked in a smart contract at the start of a project and released automatically, milestone by milestone, as work is submitted and approved — with a built-in dispute path if the two sides disagree.

No company or individual ever holds custody of the money. It lives inside the deployed contract itself, and release is enforced by code — not by trusting a promise.

---

## Why Stellar

TrustPay Escrow is built entirely on Stellar using Soroban smart contracts:

- **Contract logic** — written in Rust, compiled to WASM, deployed via the Stellar CLI
- **Funds** — held and transferred as USDC issued natively on Stellar
- **Wallets** — client and freelancer each sign with a Stellar wallet (e.g. Freighter)
- **Settlement** — fast, low-cost, and final — exactly why payment/escrow use cases fit Stellar well

Nothing here runs on Ethereum or any EVM chain — it's Stellar end to end.

---

## How It Works

1. **Client creates a project** and defines milestones (title, description, amount per milestone, due dates)
2. **Client funds the project** — the full amount is locked inside the smart contract, not held by any third party
3. **Freelancer works and submits each milestone** for review
4. **Client reviews**:
   - **Approves** → the contract automatically releases that milestone's USDC to the freelancer
   - **Disputes** → funds are frozen and a designated arbiter resolves the split
5. **Repeat until all milestones are approved and paid** — project closes with a full on-chain and off-chain audit trail

The contract doesn't judge whether work is good — that stays a human decision (the client's approval). What the contract guarantees is that once approval happens, payment is instant, automatic, and can't be reneged on — and that escrowed funds can never vanish or be double-spent while locked.

---

## Architecture

| Layer | Responsibility |
|---|---|
| **Soroban contract (Stellar)** | Escrow logic, milestone state, actual custody of funds |
| **Supabase** | Project/milestone metadata, files, comments, activity log, notifications |
| **Express backend** | Business rules, notifications, auto-release scheduling, Supabase read/write |
| **Next.js frontend** | UI — talks to Express for data, talks to the Stellar SDK directly for anything needing a wallet signature |

**Design principle:** if losing a piece of data would only be inconvenient, it lives in Supabase. If losing it would mean someone loses money or the ability to prove they were owed money, it lives on-chain.

---

## Tech Stack

**Frontend**
- Next.js (App Router), TypeScript, Tailwind CSS
- `@stellar/stellar-sdk`, `@stellar/freighter-api`
- Freighter wallet

**Backend**
- Node.js, Express
- `@supabase/supabase-js`
- `node-cron` (auto-release scheduling)

**Smart Contract**
- Rust, `soroban-sdk`
- Stellar CLI (build, test, deploy, generate TypeScript bindings)

**Database**
- Supabase (Postgres)

---

## Project Structure

```
trustpay-escrow/
├── contracts/
│   └── trustpay-escrow/
│       ├── src/lib.rs        # contract logic
│       └── Cargo.toml
├── frontend/
│   ├── app/                  # Next.js App Router
│   ├── lib/stellar.ts        # Stellar SDK integration
│   └── lib/bindings/         # auto-generated TypeScript bindings
├── backend/
│   ├── routes/projects.js
│   ├── routes/milestones.js
│   └── jobs/auto-release.js
└── docs/
    ├── README.md
    └── ARCHITECTURE.md
```

---

## Contract Functions

| Function | Description |
|---|---|
| `create_project` | Client deposits total USDC, defines milestone count and freelancer address |
| `submit_milestone` | Freelancer marks a milestone ready for review |
| `approve_milestone` | Client approves — contract auto-releases that milestone's USDC |
| `raise_dispute` | Freezes remaining funds pending arbiter review |
| `resolve_dispute` | Arbiter resolves a disputed milestone with a defined split |

---

## Getting Started

### Prerequisites
- Rust + `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)
- Node.js
- [Freighter wallet](https://www.freighter.app/) (browser extension)
- A [Supabase](https://supabase.com/) project

### Setup

```bash
# Clone the repo
git clone https://github.com/<your-username>/trustpay-escrow.git
cd trustpay-escrow

# Generate a funded testnet identity
stellar keys generate alice --network testnet --fund

# Build the contract
cd contracts/trustpay-escrow
stellar contract build

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32v1-none/release/trustpay_escrow.wasm \
  --source alice \
  --network testnet
```

Set up the frontend and backend environment variables (Supabase URL/keys, deployed contract ID), then:

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

---

## Status

🚧 **In active development.** Currently on Stellar testnet. Mainnet deployment is planned once the contract logic is complete and reviewed.

---

## Roadmap

- [x] Deploy proof-of-concept contract to testnet
- [ ] Implement full `Project`/`Milestone` contract logic
- [ ] Supabase schema + Express API
- [ ] Next.js frontend with wallet integration
- [ ] End-to-end testnet demo (real client/freelancer flow)
- [ ] Auto-release timer (on-chain, ledger-timestamp based)
- [ ] Mainnet deployment

---

## License

MIT