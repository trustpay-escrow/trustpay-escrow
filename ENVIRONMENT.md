# TrustPay Escrow — Environment & Configuration Guide ⚙️

This document describes all environment variables used across the TrustPay Escrow stack, their default values, security implications, and how to configure them for local development, CI/CD, and production deployments.

---

## Configuration Overview

TrustPay Escrow consists of three interconnected layers:
1. **Soroban Smart Contract:** Configured via network passphrase and RPC URL.
2. **Backend API (Node.js/Express):** Handles off-chain project indexing, file metadata, auto-release timers, and rate limiting.
3. **Frontend Client (Next.js):** Connects to Freighter wallet, interacts with Soroban RPC, and communicates with the backend API.

---

## Environment Variable Reference

### 1. Stellar & Soroban Network

| Variable | Required | Default / Example | Purpose |
|---|---|---|---|
| `STELLAR_NETWORK` | Yes | `testnet` | Target Stellar network environment (`testnet`, `futurenet`, `mainnet`). |
| `SOROBAN_RPC_URL` | Yes | `https://soroban-testnet.stellar.org` | RPC endpoint used for contract simulation and transaction submission. |
| `HORIZON_URL` | Yes | `https://horizon-testnet.stellar.org` | Horizon API endpoint for account balance and ledger inspection. |
| `SOROBAN_NETWORK_PASSPHRASE` | Yes | `"Test SDF Network ; September 2015"` | Network passphrase used for transaction signing verification. |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | Yes | `CCW6...45G` | Contract ID (C...) of the deployed Soroban escrow contract. |
| `NEXT_PUBLIC_DEFAULT_ARBITER_ADDRESS` | Yes | `GBRP...47WG` | Stellar public key (G...) of the default dispute resolution arbiter. |

### 2. Supported Asset Contracts (SAC)

| Variable | Required | Default / Example | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_USDC_TOKEN_ADDRESS` | Yes | `CCW6...45G` | Soroban SAC contract address for USDC settlement. |
| `NEXT_PUBLIC_EURC_TOKEN_ADDRESS` | Optional | `CDLZ...T49` | Soroban SAC contract address for EURC settlement. |
| `NEXT_PUBLIC_XLM_TOKEN_ADDRESS` | Optional | `CAS3...WY53` | Native Stellar Lumens (XLM) SAC contract address. |
| `NEXT_PUBLIC_PYUSD_TOKEN_ADDRESS` | Optional | `CX7B...45G` | PayPal USD (PYUSD) SAC contract address. |

### 3. Backend API Service

| Variable | Required | Default / Example | Purpose |
|---|---|---|---|
| `PORT` | No | `5000` | Port on which the Express REST API listens. |
| `NODE_ENV` | No | `development` | Runtime environment (`development`, `test`, `production`). |
| `API_BASE_URL` | Yes | `http://localhost:5000` | Base URL used by internal workers and health check probes. |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Allowed CORS origin for web client requests. |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` (15 min) | Time window in milliseconds for rate limiter. |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Maximum requests per IP address within the rate limit window. |

### 4. Database & Storage (Supabase / PostgreSQL)

| Variable | Required | Default / Example | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | Yes | `https://your-id.supabase.co` | PostgreSQL database REST API URL for project and proposal indexing. |
| `SUPABASE_ANON_KEY` | Yes | `eyJhbGciOiJI...` | Public client key with Row Level Security (RLS) enforcement. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | `eyJhbGciOiJI...` | Elevated service role key for automated background cron jobs. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://your-id.supabase.co` | Client-side Supabase URL for direct attachment downloads. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJhbGciOiJI...` | Client-side anon key for authenticated user sessions. |

---

## Security Best Practices

1. **Never Commit Real Secret Keys:** The repository `.gitignore` strictly excludes `.env` and `.env.*`.
2. **Zero-Custody Principle:** The platform NEVER stores or requests private keys. All signing is delegated directly to the user's Freighter browser extension.
3. **CI/CD Safe Defaults:** In CI environments (e.g. GitHub Actions), dummy non-sensitive placeholders are injected automatically to enable deterministic build testing without external service dependencies.
