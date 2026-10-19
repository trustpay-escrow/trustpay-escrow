# Contributing to TrustPay Escrow 🤝

Thank you for your interest in contributing to **TrustPay Escrow**! We welcome community contributions to build the open-source milestone payment and escrow standard for the Stellar network.

---

## 🧭 Code of Conduct

All contributors and maintainers are expected to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to [security@trustpay.network](mailto:security@trustpay.network).

---

## 🛠️ Development Environment Setup

### Prerequisites

Ensure you have the following installed on your local machine:
- **Node.js:** `v20.x` or higher (`v20.18.0+` recommended)
- **Rust Toolchain:** `1.79.0+` with target `wasm32-unknown-unknown`
- **Soroban CLI:** `stellar-cli` or `soroban-cli v22.0.0+`
- **Docker & Docker Compose:** Optional for local PostgreSQL database containerization

### 1. Clone the Repository

```bash
git clone https://github.com/trustpay-escrow/trustpay-escrow.git
cd trustpay-escrow
```

### 2. Install Dependencies

Install root, backend, and frontend dependencies:
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
cd ..
```

### 3. Setup Environment Variables

```bash
cp .env.example .env
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

---

## 🧪 Running Automated Tests

Before submitting any code, verify that all test suites pass with 0 errors:

### Smart Contracts (Soroban / Rust)
```bash
cd contracts/trustpay-escrow
cargo test
cargo build --target wasm32-unknown-unknown --release
cd ../..
```

### Backend API (TypeScript / Vitest)
```bash
cd backend
npm test
npm run build
cd ..
```

### Frontend Client (Next.js / Vitest / Playwright)
```bash
cd frontend
npm test
npm run build
cd ..
```

---

## 📝 Commit Conventions

We strictly enforce the **Conventional Commits** specification:

| Prefix | Description | Example |
|---|---|---|
| `feat:` | A new feature or user-facing capability | `feat(escrow): add multi-token settlement for EURC` |
| `fix:` | A bug fix | `fix(auth): handle freighter disconnect event gracefully` |
| `docs:` | Documentation changes only | `docs(api): document resolve_dispute parameter schemas` |
| `test:` | Adding missing tests or correcting existing tests | `test(contracts): add test for dispute arbiter split` |
| `refactor:` | Code change that neither fixes a bug nor adds a feature | `refactor(backend): modularize project service layer` |
| `ci:` | Changes to CI configuration files or scripts | `ci: add matrix test job in github actions` |

---

## 🔀 Pull Request Workflow

1. **Fork & Branch:** Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. **Implement & Test:** Write clean, documented code and include automated unit tests.
3. **Run Quality Checks:** Verify linting, typechecking, and tests:
   ```bash
   # Typecheck
   cd backend && npx tsc --noEmit
   cd ../frontend && npx tsc --noEmit
   ```
4. **Push & Open PR:** Push your branch and open a PR against `main` using our [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
5. **Review & Merge:** A maintainer will review your pull request within 48 hours.
