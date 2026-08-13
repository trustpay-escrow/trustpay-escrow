# TrustPay Escrow — Drip Wave Issue Catalog (45 Issues)

This catalog contains **45 well-defined, actionable enhancement issues** designed for open-source contributors participating in the **Drip Wave (Stellar / Soroban)** program.

---

## Table of Contents
1. [Frontend Issues (15)](#-frontend-issues-15)
2. [Backend Issues (15)](#-backend-issues-15)
3. [Fullstack & Smart Contract Issues (15)](#-fullstack--smart-contract-issues-15)
4. [Automation Script to Create GitHub Issues](#-automated-github-issue-creation)

---

## 🎨 Frontend Issues (15)

### Issue FE-01: Implement Interactive Milestone Progress & Payout Calculator
- **Labels:** `frontend`, `drip-wave`, `enhancement`
- **Overview:** Add a dynamic visual progress bar and payout calculator widget on the Project Details page to display remaining locked funds, paid amounts, and projected yield.
- **Target Files:** `frontend/src/app/projects/[id]/page.tsx`, `frontend/src/components/MilestoneTracker.tsx`
- **Acceptance Criteria:**
  - Progress bar dynamically updates based on milestone state (`Pending`, `Submitted`, `Approved`).
  - Displays total paid USDC, locked USDC, and estimated Blend yield.

### Issue FE-02: Add Advanced Filter & Search to Client/Freelancer Dashboards
- **Labels:** `frontend`, `drip-wave`, `good-first-issue`
- **Overview:** Enhance the dashboard view with multi-criteria filtering (by project status, date range, client address, and budget threshold).
- **Target Files:** `frontend/src/components/ClientDashboard.tsx`, `frontend/src/components/FreelancerDashboard.tsx`
- **Acceptance Criteria:**
  - Real-time search filter without full page reloads.
  - URL query state sync (e.g. `?status=active&search=website`).

### Issue FE-03: Implement Toast Notification System for Stellar Wallet Signature States
- **Labels:** `frontend`, `drip-wave`, `ux`
- **Overview:** Provide feedback toasts during transaction signing phases (Awaiting Signature, Submitting to Stellar Network, Confirmed on Ledger, Transaction Failed).
- **Target Files:** `frontend/src/hooks/useStellarTx.ts`, `frontend/src/components/Toast.tsx`
- **Acceptance Criteria:**
  - Toast displays Stellar transaction hash with direct link to StellarExpert explorer.
  - Auto-dismisses on success after 5 seconds.

### Issue FE-04: Build Drag-and-Drop File Upload with Image Lightbox Preview
- **Labels:** `frontend`, `drip-wave`, `ui`
- **Overview:** Create a file uploader supporting drag-and-drop attachment of project specs and proof-of-work images with image lightbox previews.
- **Target Files:** `frontend/src/components/FileUploadModal.tsx`, `frontend/src/components/ImageLightboxModal.tsx`
- **Acceptance Criteria:**
  - File size validation (< 10MB) and file type restriction (PDF, PNG, JPG, ZIP).
  - Lightbox modal allows full-screen preview and download.

### Issue FE-05: Implement Global Dark / Light Theme Switcher
- **Labels:** `frontend`, `drip-wave`, `good-first-issue`
- **Overview:** Implement a theme toggle matching the modern glassmorphism design system.
- **Target Files:** `frontend/src/components/ThemeToggle.tsx`, `frontend/src/app/globals.css`
- **Acceptance Criteria:**
  - Persists preference in `localStorage` and respects system `prefers-color-scheme`.
  - Zero layout shift during theme transition.

### Issue FE-06: Add Responsive Mobile Navigation Drawer & Wallet Switcher
- **Labels:** `frontend`, `drip-wave`, `mobile`
- **Overview:** Build a smooth sliding mobile navigation drawer with role switcher (`Client` <-> `Freelancer`) and wallet disconnect options.
- **Target Files:** `frontend/src/components/Navbar.tsx`, `frontend/src/components/MobileDrawer.tsx`
- **Acceptance Criteria:**
  - Touch-friendly hamburger menu.
  - Tested across screen widths down to 360px.

### Issue FE-07: Implement Form Validation & Auto-Save Drafts for Project Creation
- **Labels:** `frontend`, `drip-wave`, `ux`
- **Overview:** Add Zod schema validation to project creation forms and auto-save form progress to `sessionStorage`.
- **Target Files:** `frontend/src/hooks/useCreateProjectForm.ts`, `frontend/src/components/CreateProjectModal.tsx`
- **Acceptance Criteria:**
  - Shows clear inline error messages for invalid wallet addresses, negative amounts, or past due dates.
  - Restores draft automatically if page is refreshed.

### Issue FE-08: Add Milestone Delivery Verification Modal with Code/Link Submission
- **Labels:** `frontend`, `drip-wave`
- **Overview:** Provide freelancers with a structured submission modal to attach pull request links, live demo URLs, and notes when submitting work.
- **Target Files:** `frontend/src/components/SubmitMilestoneModal.tsx`
- **Acceptance Criteria:**
  - Validates URL syntax for GitHub PRs and demo links.
  - Triggers Soroban `submit_milestone` transaction upon form submission.

### Issue FE-09: Implement On-Chain Transaction History Log Component
- **Labels:** `frontend`, `drip-wave`
- **Overview:** Create an audit trail component displaying historical contract calls (`create_project`, `submit_milestone`, `approve_milestone`, `raise_dispute`) for a project.
- **Target Files:** `frontend/src/components/ProjectHistoryTab.tsx`
- **Acceptance Criteria:**
  - Displays timestamp, calling wallet address, operation type, and Stellar block explorer links.

### Issue FE-10: Build Interactive Proposal Bidding List & Accept/Reject UI
- **Labels:** `frontend`, `drip-wave`
- **Overview:** Create a client workspace view to inspect freelancer proposals, view cover notes, and trigger single-click acceptance.
- **Target Files:** `frontend/src/components/ProposalsList.tsx`
- **Acceptance Criteria:**
  - Client can accept a proposal, binding the freelancer address and locking the budget.
  - Provides confirmation modal before denying competing proposals.

### Issue FE-11: Add Custom Loading Skeleton Screens across All Views
- **Labels:** `frontend`, `drip-wave`, `good-first-issue`
- **Overview:** Replace generic loading spinners with CSS skeleton loaders matching card layouts for faster perceived load performance.
- **Target Files:** `frontend/src/components/skeletons/ProjectCardSkeleton.tsx`
- **Acceptance Criteria:**
  - Pulse animation implemented using pure CSS.
  - Applied to dashboards, project detail pages, and proposal lists.

### Issue FE-12: Implement Export Project Report as PDF / JSON
- **Labels:** `frontend`, `drip-wave`
- **Overview:** Add an export button to generate a downloadable PDF audit receipt containing project summary, milestone payout records, and Stellar tx hashes.
- **Target Files:** `frontend/src/components/ExportReceiptButton.tsx`, `frontend/src/lib/pdfGenerator.ts`
- **Acceptance Criteria:**
  - PDF includes client address, freelancer address, total amount, milestone breakdown, and timestamp.

### Issue FE-13: Add React Error Boundaries with Fallback Recovery
- **Labels:** `frontend`, `drip-wave`, `reliability`
- **Overview:** Wrap major application routes with React Error Boundaries to prevent full app crashes on RPC timeouts or malformed payloads.
- **Target Files:** `frontend/src/components/ErrorBoundary.tsx`, `frontend/src/app/layout.tsx`
- **Acceptance Criteria:**
  - Renders user-friendly error card with "Retry Connection" button.
  - Logs unhandled errors silently to console or monitoring service.

### Issue FE-14: Implement Multi-Currency Display (USDC, XLM, USD Equivalent)
- **Labels:** `frontend`, `drip-wave`
- **Overview:** Display real-time fiat USD conversion estimates next to XLM and USDC amounts using Stellar DEX / CoinGecko price feeds.
- **Target Files:** `frontend/src/components/CurrencyDisplay.tsx`, `frontend/src/hooks/useTokenPrice.ts`
- **Acceptance Criteria:**
  - Fetches token price every 60 seconds with fallback caching.
  - Shows formatted fiat values (e.g. `$1,250.00 USD`).

### Issue FE-15: Add Interactive Onboarding Tour for First-Time Users
- **Labels:** `frontend`, `drip-wave`, `ux`
- **Overview:** Build a step-by-step guided tour highlighting wallet connection, project creation, milestone approval, and yield options for new users.
- **Target Files:** `frontend/src/components/OnboardingTour.tsx`
- **Acceptance Criteria:**
  - Tour triggers only on first visit (tracked via `localStorage`).
  - User can skip or restart tour anytime from footer.

---

## ⚙️ Backend Issues (15)

### Issue BE-01: Implement Zod API Payload Validation Middleware across All Routes
- **Labels:** `backend`, `drip-wave`, `security`
- **Overview:** Create strict Zod schema validation middleware for all POST/PUT endpoints to sanitize payloads before processing.
- **Target Files:** `backend/src/middleware/validate.ts`, `backend/src/routes/projects.ts`
- **Acceptance Criteria:**
  - Returns HTTP 400 with structured JSON error details on invalid inputs.
  - Rejects extra or unrecognized keys.

### Issue BE-02: Implement Rate Limiting Middleware for Public REST Endpoints
- **Labels:** `backend`, `drip-wave`, `security`
- **Overview:** Add `express-rate-limit` to prevent spam and DDoS on public API routes (proposals, user profile creation, project searches).
- **Target Files:** `backend/src/middleware/rateLimiter.ts`, `backend/src/server.ts`
- **Acceptance Criteria:**
  - Limits requests to 100 requests per 15 minutes per IP.
  - Returns HTTP 429 Too Many Requests with retry header.

### Issue BE-03: Enhance Automated Auto-Release Cron Job with Timelock Retries
- **Labels:** `backend`, `drip-wave`, `cron`
- **Overview:** Upgrade `jobs/auto-release.js` with exponential backoff retries when simulating or submitting contract auto-releases to Horizon RPC.
- **Target Files:** `backend/src/services/autoReleaseService.ts`, `backend/src/jobs/autoReleaseCron.ts`
- **Acceptance Criteria:**
  - Retries up to 3 times on RPC network timeouts.
  - Logs execution results to Supabase `notifications` table.

### Issue BE-04: Implement Supabase Row Level Security (RLS) Policy Audit
- **Labels:** `backend`, `drip-wave`, `security`, `database`
- **Overview:** Write SQL migration enforcing strict RLS policies on `users`, `projects`, `proposals`, and `notifications` tables.
- **Target Files:** `supabase/migrations/0010_enforce_rls_policies.sql`
- **Acceptance Criteria:**
  - Users can only edit their own profile and proposals.
  - Clients can only update projects they created.

### Issue BE-05: Add Comprehensive Structured Logging with Winston / Pino
- **Labels:** `backend`, `drip-wave`, `observability`
- **Overview:** Replace basic `console.log` statements with a structured JSON logger supporting log levels (`info`, `warn`, `error`) and request correlation IDs.
- **Target Files:** `backend/src/utils/logger.ts`, `backend/src/middleware/requestLogger.ts`
- **Acceptance Criteria:**
  - Outputs structured JSON format with timestamp and route metadata.
  - Excludes sensitive wallet private keys or authorization headers.

### Issue BE-06: Implement Webhook Event Listener for Stellar Horizon Ledger Events
- **Labels:** `backend`, `drip-wave`, `stellar`
- **Overview:** Build a background worker service that streams contract event logs from Stellar Horizon RPC and updates project states in Supabase automatically.
- **Target Files:** `backend/src/services/stellarEventListener.ts`
- **Acceptance Criteria:**
  - Listens for `submit_milestone` and `approve_milestone` contract events.
  - Syncs database state instantly without relying on client HTTP calls.

### Issue BE-07: Implement Email / Discord Notification Service via Resend / Webhooks
- **Labels:** `backend`, `drip-wave`, `notifications`
- **Overview:** Add email or Discord webhook alerts when a milestone is submitted for review or a project dispute is opened.
- **Target Files:** `backend/src/services/emailService.ts`, `backend/src/controllers/notificationController.ts`
- **Acceptance Criteria:**
  - Sends email alert to client when freelancer submits milestone work.
  - Supports configurable email notifications in user settings.

### Issue BE-08: Build Server Health & RPC Monitoring Endpoint
- **Labels:** `backend`, `drip-wave`, `good-first-issue`
- **Overview:** Create a `/health` REST endpoint returning status of Express API, Supabase connection, and Stellar Horizon RPC node latency.
- **Target Files:** `backend/src/routes/health.ts`
- **Acceptance Criteria:**
  - Returns HTTP 200 OK when all services are responsive.
  - Returns HTTP 530 / 500 with breakdown if database or RPC is unreachable.

### Issue BE-09: Add Automatic Cleanup Job for Stale Unaccepted Proposals
- **Labels:** `backend`, `drip-wave`, `cron`
- **Overview:** Schedule a daily background job to archive or delete unaccepted proposals for projects that have been completed or cancelled.
- **Target Files:** `backend/src/jobs/cleanupProposals.ts`
- **Acceptance Criteria:**
  - Deletes orphaned proposal entries older than 30 days for closed projects.
  - Logs cleanup statistics.

### Issue BE-10: Implement Redis In-Memory Caching for Frequently Read Projects
- **Labels:** `backend`, `drip-wave`, `performance`
- **Overview:** Add Redis caching layer for `/api/projects` list endpoints to reduce database query load under high traffic.
- **Target Files:** `backend/src/services/cacheService.ts`, `backend/src/controllers/projectController.ts`
- **Acceptance Criteria:**
  - Caches project list responses with 60-second TTL.
  - Invalidates cache automatically upon new project creation or proposal acceptance.

### Issue BE-11: Implement Multi-Token Pricing & Conversion Oracle Endpoint
- **Labels:** `backend`, `drip-wave`
- **Overview:** Build an endpoint that fetches XLM/USDC exchange rates from Stellar DEX liquidity pools or CoinGecko API.
- **Target Files:** `backend/src/services/priceOracleService.ts`, `backend/src/routes/prices.ts`
- **Acceptance Criteria:**
  - Returns token prices in USD with 5-minute fallback caching.

### Issue BE-12: Implement JWT / Signature Verification Middleware for Sensitive Endpoints
- **Labels:** `backend`, `drip-wave`, `security`
- **Overview:** Create middleware requiring clients/freelancers to provide a signed wallet challenge header to authenticate POST requests.
- **Target Files:** `backend/src/middleware/authWallet.ts`
- **Acceptance Criteria:**
  - Verifies ed25519 signature against claimed Stellar public key.
  - Rejects expired or replay signatures.

### Issue BE-13: Build Project Analytics & Metrics Aggregation Endpoint
- **Labels:** `backend`, `drip-wave`
- **Overview:** Add an analytics endpoint returning total platform volume, active escrow value, total yield earned, and completed project count.
- **Target Files:** `backend/src/controllers/analyticsController.ts`, `backend/src/routes/analytics.ts`
- **Acceptance Criteria:**
  - Returns aggregated platform metrics in single JSON response.

### Issue BE-14: Add Database Migration Rollback Scripts & Integration Tests
- **Labels:** `backend`, `drip-wave`, `testing`
- **Overview:** Create automated test suite for database migrations ensuring schema migrations run cleanly forward and backward.
- **Target Files:** `backend/src/__tests__/migrations.test.ts`
- **Acceptance Criteria:**
  - All migrations execute without SQL errors.
  - Jest / Vitest integration suite passes cleanly.

### Issue BE-15: Implement File Upload Security Scanner & MIME Validation
- **Labels:** `backend`, `drip-wave`, `security`
- **Overview:** Add server-side magic byte inspection and size verification for uploaded project attachments before passing to Supabase storage.
- **Target Files:** `backend/src/utils/fileSecurity.ts`
- **Acceptance Criteria:**
  - Rejects executable files (.exe, .sh, .bat) regardless of file extension.
  - Limits file uploads to strict white-listed MIME types.

---

## 🔗 Fullstack & Smart Contract Issues (15)

### Issue FS-01: Soroban Contract: Implement On-Chain Ledger Timestamp Auto-Release
- **Labels:** `smart-contract`, `fullstack`, `drip-wave`
- **Overview:** Add on-chain timelock functionality to the Soroban contract allowing freelancers to claim milestone funds if client approval stalls beyond a ledger deadline.
- **Target Files:** `contracts/trustpay-escrow/src/lib.rs`, `frontend/src/lib/stellar.ts`
- **Acceptance Criteria:**
  - Adds `timelock_deadline` to `Milestone` struct.
  - Implements `claim_timelock_release` method in Rust.
  - Frontend shows "Claim Timelock" button when deadline passes.

### Issue FS-02: Soroban Contract: Add Multi-Arbiter Threshold Voting for Disputes
- **Labels:** `smart-contract`, `fullstack`, `drip-wave`
- **Overview:** Upgrade dispute resolution logic from a single arbiter address to 2-of-3 multi-signature arbiter consensus.
- **Target Files:** `contracts/trustpay-escrow/src/lib.rs`, `frontend/src/components/ArbiterModal.tsx`
- **Acceptance Criteria:**
  - Contract tracks votes from multiple arbiters before executing dispute payout.
  - Frontend displays voting progress bar for dispute cases.

### Issue FS-03: Blend Yield Optimization Integration: On-Chain Accrual & Payout
- **Labels:** `smart-contract`, `fullstack`, `drip-wave`
- **Overview:** Wire the `accrue_yield` contract logic with off-chain Blend liquidity pool yield calculations and update frontend yield metrics.
- **Target Files:** `contracts/trustpay-escrow/src/lib.rs`, `backend/src/jobs/yieldCron.ts`, `frontend/src/components/YieldCard.tsx`
- **Acceptance Criteria:**
  - Cron updates accrued yield on active contract instances.
  - On project completion, 70% of yield transfers to client and 30% to platform.

### Issue FS-04: Implement Persistent In-App Project Comments & Activity Thread
- **Labels:** `fullstack`, `drip-wave`
- **Overview:** Build a real-time messaging and discussion tab inside each project workspace for clients and freelancers to communicate.
- **Target Files:** `frontend/src/components/ProjectDiscussionTab.tsx`, `backend/src/controllers/commentController.ts`, `supabase/migrations/0011_comments_table.sql`
- **Acceptance Criteria:**
  - Messages persist in Supabase and update in real-time.
  - Wallet addresses are verified before posting messages.

### Issue FS-05: Soroban Contract: Support Native XLM & SAC Token Escrows
- **Labels:** `smart-contract`, `fullstack`, `drip-wave`
- **Overview:** Extend Soroban contract token authorization to support both wrapped native XLM and Stellar Asset Contract (SAC) tokens seamlessly.
- **Target Files:** `contracts/trustpay-escrow/src/lib.rs`, `frontend/src/components/CreateProjectModal.tsx`
- **Acceptance Criteria:**
  - Contract accepts native XLM address or custom SAC asset addresses.
  - Frontend currency dropdown lets client choose asset token upon creation.

### Issue FS-06: Implement Contract Transaction Simulation & Gas Fee Estimator
- **Labels:** `fullstack`, `drip-wave`
- **Overview:** Add pre-flight simulation before submitting Soroban contract transactions to show users exact CPU/mem gas fee estimates.
- **Target Files:** `frontend/src/lib/stellar.ts`, `frontend/src/components/TxSummaryModal.tsx`
- **Acceptance Criteria:**
  - Runs RPC simulation on `create_project` or `approve_milestone`.
  - Displays fee breakdown in XLM before prompting Freighter signature.

### Issue FS-07: Build End-to-End Testnet Demo Seed & Automated Script
- **Labels:** `fullstack`, `drip-wave`, `testing`
- **Overview:** Create an automated CLI script that generates funded Alice/Bob testnet wallets, deploys the contract, creates a project, and runs an end-to-end milestone lifecycle demo.
- **Target Files:** `scripts/demo-e2e.ts`, `package.json`
- **Acceptance Criteria:**
  - Runs with single command `npm run demo:e2e`.
  - Outputs transaction hashes and finalized account balances.

### Issue FS-08: Add Milestone Proof-of-Work File Hashing On-Chain
- **Labels:** `smart-contract`, `fullstack`, `drip-wave`
- **Overview:** Allow freelancers to submit SHA-256 hash of deliverable files on-chain during `submit_milestone` for immutable proof of submission.
- **Target Files:** `contracts/trustpay-escrow/src/lib.rs`, `frontend/src/components/SubmitMilestoneModal.tsx`
- **Acceptance Criteria:**
  - Frontend computes SHA-256 hash of attachment file before upload.
  - Hash is stored in Soroban contract state alongside milestone index.

### Issue FS-09: Build Multi-Sig Client Wallet Support (SEP-0007 / Freighter Multi-Sig)
- **Labels:** `fullstack`, `drip-wave`, `stellar`
- **Overview:** Support corporate client accounts requiring multi-signature approval from multiple team members before executing contract deposits or approvals.
- **Target Files:** `frontend/src/lib/stellar.ts`, `frontend/src/hooks/useMultiSig.ts`
- **Acceptance Criteria:**
  - Detects multi-sig requirements on client address.
  - Supports collecting partial signatures before broadcasting to Stellar ledger.

### Issue FS-10: Soroban Contract: Emergency Pause & Admin Safety Circuit Breaker
- **Labels:** `smart-contract`, `fullstack`, `drip-wave`, `security`
- **Overview:** Add emergency admin circuit breaker mechanism to pause contract operations in the event of an identified vulnerability or protocol exploit.
- **Target Files:** `contracts/trustpay-escrow/src/lib.rs`
- **Acceptance Criteria:**
  - Admin address can invoke `set_paused(true)`.
  - All state-changing methods reject execution while paused.

### Issue FS-11: Implement Freelancer Portfolio & Verified Rating System
- **Labels:** `fullstack`, `drip-wave`
- **Overview:** Build on-chain verified rating system where clients leave 1-5 star reviews and feedback upon successful project completion.
- **Target Files:** `frontend/src/components/RatingModal.tsx`, `backend/src/controllers/userController.ts`, `supabase/migrations/0012_ratings_table.sql`
- **Acceptance Criteria:**
  - Ratings can only be submitted for completed projects with approved milestones.
  - Freelancer profile displays average rating and verified project count.

### Issue FS-12: Implement Partial Refund / Contract Cancellation Flow
- **Labels:** `smart-contract`, `fullstack`, `drip-wave`
- **Overview:** Allow client and freelancer to mutually agree on early project termination, returning unapproved milestone funds to client without opening a dispute.
- **Target Files:** `contracts/trustpay-escrow/src/lib.rs`, `frontend/src/components/CancelProjectModal.tsx`
- **Acceptance Criteria:**
  - Requires signatures from both Client and Freelancer.
  - Refund transfers remaining locked escrow funds back to client.

### Issue FS-13: Add Web3 Wallet Sign-in with Ethereum / Stellar (SIWE / SIWS Standard)
- **Labels:** `fullstack`, `drip-wave`, `security`
- **Overview:** Implement cryptographic challenge-response login standard (Sign-In With Stellar) for secure backend API authentication.
- **Target Files:** `frontend/src/lib/siws.ts`, `backend/src/middleware/authWallet.ts`
- **Acceptance Criteria:**
  - Frontend requests challenge nonce from backend and prompts wallet signature.
  - Backend verifies signature and issues short-lived JWT cookie.

### Issue FS-14: Build Interactive Contract Event Indexer & GraphQL / REST Explorer
- **Labels:** `fullstack`, `drip-wave`
- **Overview:** Expose an indexed API endpoint allowing external developers to query historical escrow stats, average completion times, and dispute rates.
- **Target Files:** `backend/src/controllers/indexerController.ts`, `backend/src/routes/indexer.ts`
- **Acceptance Criteria:**
  - Supports filtering events by project ID, client address, and milestone state.

### Issue FS-15: Soroban Contract: Optimistic Auto-Approval with Challenge Period
- **Labels:** `smart-contract`, `fullstack`, `drip-wave`
- **Overview:** Implement optimistic milestone approval where work is automatically approved after 7 days unless client actively files a dispute.
- **Target Files:** `contracts/trustpay-escrow/src/lib.rs`, `frontend/src/components/MilestoneTracker.tsx`
- **Acceptance Criteria:**
  - Milestone stores `submitted_at` ledger timestamp.
  - `claim_optimistic_approval` releases funds if 7 days elapse without client challenge.

---

## 🤖 Automated GitHub Issue Creation

Once GitHub CLI is authenticated (`gh auth login`), you can run the provided PowerShell automation script `scripts/create_issues.ps1` to publish all 45 issues to your GitHub repository automatically!
