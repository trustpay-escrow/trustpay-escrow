# Security Policy — TrustPay Escrow

## Security Overview

TrustPay Escrow is committed to protecting users, locked smart contract assets, and off-chain metadata. As a non-custodial milestone payment platform operating on the Stellar blockchain via Soroban smart contracts, security invariants are enforced at the smart contract level, API backend level, and frontend client level.

---

## Security Invariants

1. **Non-Custodial Integrity:** Neither TrustPay maintainers nor third parties possess master keys or withdrawal permissions over locked escrow funds. Funds can only be released via valid Soroban contract invocations signed by the Client, Freelancer, or Arbiter according to state machine rules.
2. **Explicit Multi-Party Authorization (`require_auth`):** All state-changing smart contract invocations (`create_project`, `submit_milestone`, `approve_milestone`, `raise_dispute`, `resolve_dispute`) enforce strict caller authentication using `Address::require_auth()`.
3. **Yield Allocation Isolation:** Principal escrow balances earmarked for liquid payouts are strictly separated from protocol yield reserves (e.g. Blend yield protocol integration).
4. **Input Sanitation & Strict Types:** Off-chain backend services sanitize all user inputs using Zod schemas, prevent SQL injection via Supabase parameterized queries, and implement rate-limiting and security headers (Helmet, CORS policies).
5. **No Secret Ingestion in Repository:** Private keys, seed phrases, database passwords, and API secret tokens must NEVER be committed to source control. Environment variables (`.env`) are excluded via `.gitignore`.

---

## Reporting Vulnerabilities

If you discover a potential security vulnerability within TrustPay Escrow (smart contracts, backend services, or frontend client), please report it to our maintainer security team rather than opening a public issue.

### Disclosure Channel

- **Primary Contact:** [security@trustpay.network](mailto:security@trustpay.network)
- **PGP Key / Encrypted Messaging:** Available upon initial inquiry response.

### What to Include in Your Report

1. Description of the vulnerability and potential impact.
2. Step-by-step proof of concept (PoC) or script to reproduce the issue.
3. Affected components (e.g., Soroban smart contract function, API endpoint, or UI hook).
4. Any proposed remediations or patches (optional).

---

## Response SLA

- **Initial Acknowledgment:** Within **24 hours** of report receipt.
- **Triage & Severity Assessment:** Within **48 hours**.
- **Patch & Public Disclosure Timeline:** Within **14 days** (or coordinated disclosure window agreed upon with reporter).

---

## Supported Versions

| Component | Target Version / Branch | Security Status |
|---|---|---|
| Soroban Escrow Contract | `v1.0.x` (`main`) | Supported |
| Express API Backend | `v1.0.x` (`main`) | Supported |
| Next.js Frontend | `v1.0.x` (`main`) | Supported |

---

## Automated Security Audits in CI/CD

Our continuous integration pipeline automatically runs:
- Rust dependency and compiler check (`cargo check` & static safety tests)
- TypeScript strict compilation check (`tsc --noEmit`)
- Dependency audit (`npm audit` & security check scripts)
