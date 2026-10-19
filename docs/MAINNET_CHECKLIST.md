# Production & Mainnet Deployment Checklist 🚀

This document defines the operational readiness standards required before deploying TrustPay Escrow smart contracts and services to Stellar Mainnet.

---

## 1. Smart Contract Verification & Audit

- [ ] **Deterministic Build:** Ensure contract WASM builds reproducibly using official Stellar builder images.
- [ ] **Audit Verification:** Formal security review of Rust Soroban contracts with zero critical or high-severity vulnerabilities.
- [ ] **State Footprint Optimization:** Optimize persistent vs. temporary storage footprint to reduce ledger rental fees.
- [ ] **Authorization Invariants:** Verify all state mutations strictly require `Address::require_auth()`.

---

## 2. Infrastructure & Key Management

- [ ] **Multi-Signature Arbiter:** Replace single arbiter address with a multisig threshold account or decentralized governance DAO.
- [ ] **RPC Redundancy:** Configure multi-region Soroban RPC failover providers to ensure continuous transaction processing.
- [ ] **Database Replication:** Enable read-replicas and point-in-time recovery (PITR) on PostgreSQL / Supabase.
- [ ] **Secret Hygiene:** Ensure all production credentials (database URLs, service role keys) are managed via encrypted secret stores (e.g., Doppler, AWS Secrets Manager).

---

## 3. Client & Frontend Hardening

- [ ] **Content Security Policy (CSP):** Enforce strict CSP headers preventing unauthorized script execution.
- [ ] **Subresource Integrity (SRI):** Validate all external CDN assets with SRI cryptographic hashes.
- [ ] **Production Telemetry:** Integrate error monitoring (Sentry) and privacy-preserving analytics without logging wallet private data.
