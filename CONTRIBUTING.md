# Contributing to TrustPay Escrow 🤝

Thank you for your interest in contributing to **TrustPay Escrow**! We welcome community contributions to build the open-source milestone payment and escrow standard for the Stellar network.

All development, community contributions, features, bug fixes, and documentation improvements must be targeted against the **`contributions`** branch.

---

## 🌳 Branching Strategy & Architecture

TrustPay Escrow follows a structured branch hierarchy to ensure stability on `main` while enabling rapid, continuous collaboration on `contributions`:

| Branch | Purpose | PR Target | Stability |
|---|---|---|---|
| **`main`** | Production releases, deployment artifacts, and stable releases | Protected (Maintainer merges only) | Stable |
| **`contributions`** | **Primary active development & community contribution branch** | **Target for all contributor PRs** | Active Integration |
| **`feat/*`** | New features and protocol enhancements | `contributions` | In Development |
| **`fix/*`** | Bug fixes and patch resolutions | `contributions` | In Development |
| **`docs/*`** | Documentation improvements and guides | `contributions` | In Development |
| **`refactor/*`** | Code cleanup, optimization, and architecture refactoring | `contributions` | In Development |

> [!IMPORTANT]
> **Always branch off and target `contributions`!**
> Do not open Pull Requests directly against `main`. All pull requests must target the `contributions` branch for review, automated CI testing, and staging before being merged into `main` for release.

---

## 🧭 Code of Conduct

All contributors and maintainers are expected to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to [security@trustpay.network](mailto:security@trustpay.network).

---

## 🛠️ Development Environment Setup

### Prerequisites

Ensure you have the following installed on your local machine:
- **Node.js:** `v20.x` or higher (`v22.x` recommended)
- **Rust Toolchain:** `1.79.0+` with target `wasm32-unknown-unknown`
- **Soroban CLI:** `stellar-cli` or `soroban-cli v22.0.0+`
- **Docker & Docker Compose:** Optional for local PostgreSQL/Supabase database containerization

### 1. Clone & Switch to `contributions`

```bash
git clone https://github.com/trustpay-escrow/trustpay-escrow.git
cd trustpay-escrow

# Switch to the active contributions branch
git checkout contributions
git pull origin contributions
```

### 2. Create Your Feature Branch

Always create your work branch from the latest `contributions` branch:

```bash
git checkout -b feat/your-feature-name
# or for bug fixes:
git checkout -b fix/issue-description
```

### 3. Install Dependencies

Install dependencies for the backend and frontend:

```bash
# Backend dependencies (includes automatic Prisma Client generation)
cd backend
npm install
npm run prisma:generate

# Frontend dependencies
cd ../frontend
npm install
cd ..
```

### 4. Setup Environment Variables

```bash
cp .env.example .env
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

Configure your local `.env` values (Stellar testnet keys, Supabase / PostgreSQL database URL) as described in the [Environment Guide](ENVIRONMENT.md).

---

## 🧪 Running Automated Tests & Quality Checks

Before submitting any code, verify that all test suites pass with 0 errors:

### Smart Contracts (Soroban / Rust)
```bash
cd contracts/trustpay-escrow
cargo test
cargo build --target wasm32-unknown-unknown --release
cd ../..
```

### Backend API (TypeScript / Vitest / Prisma)
```bash
cd backend
npm run typecheck
npm test
npm run build
cd ..
```

### Frontend Client (Next.js / Vitest / TypeScript)
```bash
cd frontend
npm run typecheck
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
| `ci:` | Changes to CI configuration files or scripts | `ci: add contributions branch trigger in github actions` |

---

## 🔀 Step-by-Step Pull Request Workflow

1. **Sync with `contributions`:**
   ```bash
   git checkout contributions
   git pull origin contributions
   ```

2. **Create Your Working Branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Implement, Format & Test:**
   - Write clean, type-safe, and documented code.
   - Include unit and integration tests for new logic.
   - Ensure `npm run typecheck` and `npm test` pass with 0 errors.

4. **Commit Your Changes:**
   ```bash
   git add .
   git commit -m "feat(module): descriptive explanation of your change"
   ```

5. **Push to Your Fork / Remote:**
   ```bash
   git push -u origin feat/your-feature-name
   ```

6. **Open a Pull Request against `contributions`:**
   - In GitHub, set **Base branch:** `contributions` ⬅️ **Compare branch:** `feat/your-feature-name`.
   - Complete the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
   - Link any associated issues (e.g., `Closes #42`).

7. **CI & Maintainer Review:**
   - Automated GitHub Actions will run secret scans, contract tests, backend tests, and frontend builds.
   - A project maintainer will review your PR within 48 hours and provide feedback or merge into `contributions`.

