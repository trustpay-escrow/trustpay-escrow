# Changelog 📜

All notable changes to **TrustPay Escrow** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Comprehensive Vitest and component unit test suites for frontend and backend.
- Playwright end-to-end user journey navigation test suite.
- Gitleaks secret detection configuration (`.gitleaks.toml`, `.gitleaksignore`).
- Standalone multi-stage production `Dockerfile` and `.dockerignore`.
- Reviewer automated verification script (`scripts/seed-and-verify.ts`).
- Detailed technical architecture specifications in `docs/` (`COMPONENTS.md`, `STATE_ARCHITECTURE.md`, `CONTRACT_CALLS.md`, `API_INTEGRATION.md`, `MAINNET_CHECKLIST.md`).

### Changed
- Standardized GitHub Actions CI pipeline (`.github/workflows/ci.yml`) with automated secret scanning, typecheck, contract verification, and multi-package builds.
- Upgraded Soroban smart contract test suite to eliminate deprecated SDK methods.
- Modernized backend domain modularity and error handling middleware.

---

## [1.0.0] - 2026-10-15

### Added
- **Soroban Smart Contract:** Core non-custodial milestone escrow primitive in Rust (`contracts/trustpay-escrow`).
- **Blend Yield Protocol Integration:** 70/30 principal and accrued yield distribution mechanism upon milestone completion.
- **Multi-Asset Settlement:** Native support for Stellar SAC tokens (USDC, EURC, XLM, PYUSD).
- **Single-Identity Multi-Role UI:** Seamless toggle between Client and Freelancer dashboards within a connected Freighter wallet.
- **Dispute Resolution Flow:** Arbiter intervention pathway with proportional funds split enforcement.
- **Express / Supabase Backend:** Off-chain proposal management, file attachment persistence, and auto-release cron monitoring.
- **Open Source Governance:** Established `LICENSE` (MIT), `SECURITY.md`, `CODE_OF_CONDUCT.md`, and issue templates.
