# TrustPay Escrow — Drip Wave Issue Catalog (45 Issues)

This document contains **45 detailed enhancement issues** structured according to the official **Drip Wave** specification.

---

## 🎨 Frontend Issues (15)

### FE-01: Interactive Milestone Progress and Payout Calculator
```markdown
📌 Summary
Add dynamic visual progress bar and payout calculator widget on Project Details page.

📖 Background & Problem
Clients and freelancers lack real-time visual feedback on remaining locked escrow funds vs approved payouts.
Problem Statement: Hard to track remaining project balance and projected yield at a glance.

💡 Proposed Solution
Build interactive progress bar component calculating approved USDC, locked USDC, and estimated Blend yield.

📂 Files Likely Affected
frontend/src/app/projects/[id]/page.tsx
frontend/src/components/MilestoneTracker.tsx

✅ Acceptance Criteria
- Progress bar dynamically updates based on milestone states (Pending, Submitted, Approved).
- Displays total paid USDC, locked USDC, and estimated Blend yield.

🧪 Testing Requirements
Mock milestone states and test rendering across various budget splits.

Category: Frontend | Milestone: Milestone 1 – Core Features | Complexity: Medium (5 pts)
```

---

### FE-02: Advanced Filter and Search for Client/Freelancer Dashboards
```markdown
📌 Summary
Enhance dashboard view with multi-criteria filtering and real-time search.

📖 Background & Problem
Users with multiple active projects struggle to find specific projects.
Problem Statement: No search or status filter on project list views.

💡 Proposed Solution
Add filter controls for status, date range, client address, and budget threshold with URL query sync.

📂 Files Likely Affected
frontend/src/components/ClientDashboard.tsx
frontend/src/components/FreelancerDashboard.tsx

✅ Acceptance Criteria
- Real-time search filter without full page reloads.
- URL query state sync (e.g. ?status=active&search=website).

🧪 Testing Requirements
Verify filter logic with empty results and multi-select combinations.

Category: Frontend | Milestone: Milestone 1 – Core Features | Complexity: Low (3 pts)
```

---

### FE-03: Toast Notification System for Stellar Wallet Signature States
```markdown
📌 Summary
Provide feedback toasts during transaction signing and submission phases.

📖 Background & Problem
Users are confused while waiting for Freighter wallet signatures or ledger confirmation.
Problem Statement: Lack of visual progress feedback during web3 transaction lifecycles.

💡 Proposed Solution
Implement toast component showing signing, broadcasting, confirmation, and failure states with StellarExpert links.

📂 Files Likely Affected
frontend/src/hooks/useStellarTx.ts
frontend/src/components/Toast.tsx

✅ Acceptance Criteria
- Displays Stellar transaction hash with direct link to StellarExpert explorer.
- Auto-dismisses on success after 5 seconds.

🧪 Testing Requirements
Simulate rejected wallet signatures and network timeouts.

Category: Frontend | Milestone: Milestone 1 – Core Features | Complexity: Medium (5 pts)
```

---

### FE-04: Drag-and-Drop File Upload with Image Lightbox Preview
```markdown
📌 Summary
Create file uploader supporting drag-and-drop attachment with image lightbox preview.

📖 Background & Problem
Uploading project specifications and proof of work requires clunky file inputs.
Problem Statement: No drag-and-drop or full-resolution image preview.

💡 Proposed Solution
Build drag-and-drop upload zone integrated with Supabase storage and a full-screen lightbox modal.

📂 Files Likely Affected
frontend/src/components/FileUploadModal.tsx
frontend/src/components/ImageLightboxModal.tsx

✅ Acceptance Criteria
- File size validation (< 10MB) and file type restriction (PDF, PNG, JPG, ZIP).
- Lightbox modal allows full-screen preview and direct download.

🧪 Testing Requirements
Test uploading invalid file extensions and large files.

Category: Frontend | Milestone: Milestone 2 – UI/UX Polish | Complexity: Medium (5 pts)
```

---

### FE-05: Global Dark / Light Theme Switcher
```markdown
📌 Summary
Implement theme toggle matching modern glassmorphism design system.

📖 Background & Problem
The application currently defaults to dark mode without theme switching capability.
Problem Statement: Users cannot toggle light mode according to preference.

💡 Proposed Solution
Add theme context provider and toggle button storing choice in localStorage.

📂 Files Likely Affected
frontend/src/components/ThemeToggle.tsx
frontend/src/app/globals.css

✅ Acceptance Criteria
- Persists preference in localStorage and respects system prefers-color-scheme.
- Zero layout shift during theme transition.

🧪 Testing Requirements
Verify toggle state across browser reloads.

Category: Frontend | Milestone: Milestone 2 – UI/UX Polish | Complexity: Low (2 pts)
```

---

### FE-06: Responsive Mobile Navigation Drawer and Wallet Switcher
```markdown
📌 Summary
Build smooth sliding mobile navigation drawer with role switcher and wallet disconnect.

📖 Background & Problem
Navigation controls wrap awkwardly on mobile devices below 480px width.
Problem Statement: Poor mobile layout UX for top navbar actions.

💡 Proposed Solution
Create responsive slide-over drawer containing menu links, active role toggle, and wallet status.

📂 Files Likely Affected
frontend/src/components/Navbar.tsx
frontend/src/components/MobileDrawer.tsx

✅ Acceptance Criteria
- Touch-friendly hamburger menu triggers slide-over drawer.
- Tested across screen widths down to 360px.

🧪 Testing Requirements
Test open/close animations and breakpoint triggers on mobile viewports.

Category: Frontend | Milestone: Milestone 2 – Mobile Responsiveness | Complexity: Medium (5 pts)
```

---

### FE-07: Form Validation and Auto-Save Drafts for Project Creation
```markdown
📌 Summary
Add Zod schema validation to project creation forms and auto-save progress.

📖 Background & Problem
Accidentally refreshing the project creation modal loses all typed milestone details.
Problem Statement: No draft persistence or pre-submission input validation.

💡 Proposed Solution
Validate form inputs with Zod and save form draft state to sessionStorage.

📂 Files Likely Affected
frontend/src/hooks/useCreateProjectForm.ts
frontend/src/components/CreateProjectModal.tsx

✅ Acceptance Criteria
- Shows clear inline error messages for invalid wallet addresses, negative amounts, or past due dates.
- Restores draft automatically if page is refreshed.

🧪 Testing Requirements
Submit invalid payloads and verify error messages.

Category: Frontend | Milestone: Milestone 1 – Core Features | Complexity: Low (3 pts)
```

---

### FE-08: Milestone Delivery Verification Modal with Code/Link Submission
```markdown
📌 Summary
Provide freelancers structured submission modal to attach PR links and demo URLs.

📖 Background & Problem
Submitting a milestone currently lacks a dedicated interface to attach proof of work.
Problem Statement: Freelancers cannot attach pull request links or notes when marking milestone submitted.

💡 Proposed Solution
Build submission modal prompting for deliverable description, PR link, and live demo URL.

📂 Files Likely Affected
frontend/src/components/SubmitMilestoneModal.tsx

✅ Acceptance Criteria
- Validates URL syntax for GitHub PRs and demo links.
- Triggers Soroban submit_milestone transaction upon form submission.

🧪 Testing Requirements
Verify form submission and contract call trigger.

Category: Frontend | Milestone: Milestone 1 – Core Features | Complexity: Medium (5 pts)
```

---

### FE-09: On-Chain Transaction History Log Component
```markdown
📌 Summary
Create audit trail component displaying historical contract calls for a project.

📖 Background & Problem
Users cannot view the complete chronological sequence of contract transactions.
Problem Statement: On-chain project events are hidden from the UI.

💡 Proposed Solution
Build transaction history tab fetching and listing contract operations with block explorer links.

📂 Files Likely Affected
frontend/src/components/ProjectHistoryTab.tsx

✅ Acceptance Criteria
- Displays timestamp, calling wallet address, operation type, and Stellar block explorer links.

🧪 Testing Requirements
Verify history rendering for active and completed projects.

Category: Frontend | Milestone: Milestone 2 – Audit & Analytics | Complexity: Medium (5 pts)
```

---

### FE-10: Interactive Proposal Bidding List and Accept/Reject UI
```markdown
📌 Summary
Create client workspace view to inspect freelancer proposals and trigger single-click acceptance.

📖 Background & Problem
Clients cannot compare candidate proposals directly inside the project details page.
Problem Statement: Missing proposal management dashboard view for clients.

💡 Proposed Solution
Add proposals tab to project workspace rendering applicant cover notes, portfolio links, and Accept/Deny actions.

📂 Files Likely Affected
frontend/src/components/ProposalsList.tsx

✅ Acceptance Criteria
- Client can accept a proposal, binding freelancer address and updating project status.
- Provides confirmation modal before denying competing proposals.

🧪 Testing Requirements
Test proposal acceptance and denial state changes.

Category: Frontend | Milestone: Milestone 1 – Core Features | Complexity: High (8 pts)
```

---

### FE-11: Custom Loading Skeleton Screens across All Views
```markdown
📌 Summary
Replace generic loading spinners with CSS skeleton loaders matching card layouts.

📖 Background & Problem
Spinner loaders cause abrupt layout shifts when data finishes loading.
Problem Statement: Poor perceived performance during initial RPC and database fetches.

💡 Proposed Solution
Create pulse-animated skeleton loader components mirroring project cards and table rows.

📂 Files Likely Affected
frontend/src/components/skeletons/ProjectCardSkeleton.tsx

✅ Acceptance Criteria
- Pulse animation implemented using pure CSS.
- Applied to dashboards, project detail pages, and proposal lists.

🧪 Testing Requirements
Inspect visual transition from loading state to populated data.

Category: Frontend | Milestone: Milestone 2 – UI/UX Polish | Complexity: Low (2 pts)
```

---

### FE-12: Export Project Report as PDF / JSON
```markdown
📌 Summary
Add export button to generate downloadable PDF audit receipt containing project summary.

📖 Background & Problem
Freelancers and clients need official documentation of escrow payouts for tax/accounting.
Problem Statement: No downloadable export or receipt functionality.

💡 Proposed Solution
Integrate PDF generation library to create summary document with milestone payout hashes and timestamps.

📂 Files Likely Affected
frontend/src/components/ExportReceiptButton.tsx
frontend/src/lib/pdfGenerator.ts

✅ Acceptance Criteria
- PDF includes client address, freelancer address, total amount, milestone breakdown, and timestamp.

🧪 Testing Requirements
Generate PDF report and verify data accuracy against on-chain records.

Category: Frontend | Milestone: Milestone 3 – Enterprise Features | Complexity: Medium (5 pts)
```

---

### FE-13: React Error Boundaries with Fallback Recovery
```markdown
📌 Summary
Wrap major application routes with React Error Boundaries to prevent full app crashes.

📖 Background & Problem
Uncaught RPC errors or missing props cause the entire Next.js app to render a blank screen.
Problem Statement: Weak runtime error resilience in production.

💡 Proposed Solution
Implement ErrorBoundary component rendering friendly recovery fallback with "Retry Connection" button.

📂 Files Likely Affected
frontend/src/components/ErrorBoundary.tsx
frontend/src/app/layout.tsx

✅ Acceptance Criteria
- Renders user-friendly error card with "Retry Connection" button.
- Logs unhandled errors silently to console.

🧪 Testing Requirements
Throw artificial render error and verify fallback UI.

Category: Frontend | Milestone: Milestone 2 – Reliability | Complexity: Low (3 pts)
```

---

### FE-14: Multi-Currency Display (USDC, XLM, USD Equivalent)
```markdown
📌 Summary
Display real-time fiat USD conversion estimates next to XLM and USDC amounts.

📖 Background & Problem
Users struggle to mentally convert XLM/USDC token amounts into fiat USD value.
Problem Statement: Prices displayed purely in crypto units without fiat reference.

💡 Proposed Solution
Create currency converter hook fetching DEX/CoinGecko rates and rendering formatted USD equivalents.

📂 Files Likely Affected
frontend/src/components/CurrencyDisplay.tsx
frontend/src/hooks/useTokenPrice.ts

✅ Acceptance Criteria
- Fetches token price every 60 seconds with fallback caching.
- Shows formatted fiat values (e.g. $1,250.00 USD).

🧪 Testing Requirements
Test API price fetching and fallback formatting when offline.

Category: Frontend | Milestone: Milestone 2 – UI/UX Polish | Complexity: Medium (5 pts)
```

---

### FE-15: Interactive Onboarding Tour for First-Time Users
```markdown
📌 Summary
Build step-by-step guided tour highlighting wallet connection and project workflows.

📖 Background & Problem
New users entering the platform are unsure how escrow deposits and milestone approvals work.
Problem Statement: High initial user drop-off due to missing onboarding guidance.

💡 Proposed Solution
Build interactive tooltip tour guiding users through wallet connection, project creation, and dashboard switching.

📂 Files Likely Affected
frontend/src/components/OnboardingTour.tsx

✅ Acceptance Criteria
- Tour triggers only on first visit (tracked via localStorage).
- User can skip or restart tour anytime from footer.

🧪 Testing Requirements
Verify localStorage flag and tour step transitions.

Category: Frontend | Milestone: Milestone 2 – UI/UX Polish | Complexity: Medium (5 pts)
```

---

## ⚙️ Backend Issues (15)

### BE-01: Zod API Payload Validation Middleware across All Routes
```markdown
📌 Summary
Create strict Zod schema validation middleware for all POST/PUT endpoints.

📖 Background & Problem
Incoming HTTP request bodies are not rigorously validated before reaching controllers.
Problem Statement: Potential payload injection or malformed data reaching database.

💡 Proposed Solution
Implement generic validation middleware verifying request params, query, and body against Zod schemas.

📂 Files Likely Affected
backend/src/middleware/validate.ts
backend/src/routes/projects.ts

✅ Acceptance Criteria
- Returns HTTP 400 with structured JSON error details on invalid inputs.
- Rejects extra or unrecognized keys.

🧪 Testing Requirements
Send malformed JSON payloads to API routes and verify HTTP 400 response.

Category: Backend | Milestone: Milestone 1 – Core API | Complexity: Medium (5 pts)
```

---

### BE-02: Rate Limiting Middleware for Public REST Endpoints
```markdown
📌 Summary
Add express-rate-limit to prevent spam on public API routes.

📖 Background & Problem
Public endpoints like proposal submissions can be spammed by automated scripts.
Problem Statement: API vulnerable to abuse and denial of service.

💡 Proposed Solution
Configure express-rate-limit middleware with IP-based window limits.

📂 Files Likely Affected
backend/src/middleware/rateLimiter.ts
backend/src/server.ts

✅ Acceptance Criteria
- Limits requests to 100 requests per 15 minutes per IP address.
- Returns HTTP 429 Too Many Requests with Retry-After header.

🧪 Testing Requirements
Execute rapid automated requests and verify rate limit response.

Category: Backend | Milestone: Milestone 1 – Security | Complexity: Low (3 pts)
```

---

### BE-03: Enhance Automated Auto-Release Cron Job with Timelock Retries
```markdown
📌 Summary
Upgrade auto-release cron service with exponential backoff retries.

📖 Background & Problem
Temporary Horizon RPC network congestion can cause scheduled auto-releases to fail silently.
Problem Statement: Failed cron runs do not retry automatically.

💡 Proposed Solution
Implement retry mechanism with exponential backoff for Stellar contract simulation and execution.

📂 Files Likely Affected
backend/src/services/autoReleaseService.ts
backend/src/jobs/autoReleaseCron.ts

✅ Acceptance Criteria
- Retries up to 3 times on RPC network timeouts.
- Logs execution results to Supabase notifications table.

🧪 Testing Requirements
Simulate RPC failures and verify retry attempts.

Category: Backend | Milestone: Milestone 2 – Automation | Complexity: Medium (5 pts)
```

---

### BE-04: Supabase Row Level Security (RLS) Policy Audit
```markdown
📌 Summary
Write SQL migration enforcing strict RLS policies on database tables.

📖 Background & Problem
Database tables lack explicit row-level access controls for anonymous connections.
Problem Statement: Risk of unauthorized data access or modification via Supabase client.

💡 Proposed Solution
Add SQL migration enabling RLS and enforcing client/freelancer ownership checks.

📂 Files Likely Affected
supabase/migrations/0010_enforce_rls_policies.sql

✅ Acceptance Criteria
- Users can only edit their own profile and proposals.
- Clients can only update projects they created.

🧪 Testing Requirements
Execute SQL queries as unauthorized role and verify access rejection.

Category: Backend | Milestone: Milestone 1 – Security | Complexity: High (8 pts)
```

---

### BE-05: Comprehensive Structured Logging with Winston / Pino
```markdown
📌 Summary
Replace console.log statements with structured JSON logger supporting log levels.

📖 Background & Problem
Current console logging lacks structured format, making production debugging difficult.
Problem Statement: Unstructured logs make searching and error tracking difficult.

💡 Proposed Solution
Integrate Winston logger with JSON formatting, log levels, and request correlation IDs.

📂 Files Likely Affected
backend/src/utils/logger.ts
backend/src/middleware/requestLogger.ts

✅ Acceptance Criteria
- Outputs structured JSON format with timestamp and route metadata.
- Excludes sensitive wallet private keys or authorization headers.

🧪 Testing Requirements
Trigger server errors and inspect output log schema.

Category: Backend | Milestone: Milestone 2 – Observability | Complexity: Medium (5 pts)
```

---

### BE-06: Webhook Event Listener for Stellar Horizon Ledger Events
```markdown
📌 Summary
Build background worker service streaming contract event logs from Stellar Horizon RPC.

📖 Background & Problem
Database state updates currently rely on client-side HTTP calls after transactions.
Problem Statement: If client browser closes before API call, database becomes out of sync with chain.

💡 Proposed Solution
Implement event stream listener capturing Soroban contract events and updating Supabase automatically.

📂 Files Likely Affected
backend/src/services/stellarEventListener.ts

✅ Acceptance Criteria
- Listens for submit_milestone and approve_milestone contract events.
- Syncs database state instantly without relying on client HTTP calls.

🧪 Testing Requirements
Trigger testnet contract invocation and verify database sync.

Category: Backend | Milestone: Milestone 2 – Infrastructure | Complexity: High (8 pts)
```

---

### BE-07: Email / Discord Notification Service via Resend / Webhooks
```markdown
📌 Summary
Add email or Discord webhook alerts when milestone work is submitted or disputed.

📖 Background & Problem
Clients must manually refresh the dashboard to check if a freelancer submitted work.
Problem Statement: Missing real-time off-platform push notifications.

💡 Proposed Solution
Integrate Resend email API or Discord webhook dispatcher triggered on milestone events.

📂 Files Likely Affected
backend/src/services/emailService.ts
backend/src/controllers/notificationController.ts

✅ Acceptance Criteria
- Sends email alert to client when freelancer submits milestone work.
- Supports configurable notification settings in user profile.

🧪 Testing Requirements
Trigger notification event and verify email delivery to inbox/webhook.

Category: Backend | Milestone: Milestone 2 – Notifications | Complexity: Medium (5 pts)
```

---

### BE-08: Server Health and RPC Monitoring Endpoint
```markdown
📌 Summary
Create /health REST endpoint returning status of API, Supabase, and Stellar RPC.

📖 Background & Problem
DevOps monitoring lacks an endpoint to check backend service health.
Problem Statement: Unable to perform automated health checks or uptime monitoring.

💡 Proposed Solution
Build /health route checking DB connectivity and RPC node response latency.

📂 Files Likely Affected
backend/src/routes/health.ts

✅ Acceptance Criteria
- Returns HTTP 200 OK when all services are responsive.
- Returns HTTP 500 with breakdown if database or RPC is unreachable.

🧪 Testing Requirements
Call /health endpoint and verify response schema.

Category: Backend | Milestone: Milestone 1 – Core API | Complexity: Low (2 pts)
```

---

### BE-09: Automatic Cleanup Job for Stale Unaccepted Proposals
```markdown
📌 Summary
Schedule daily background job to archive or delete unaccepted proposals.

📖 Background & Problem
Cancelled or completed projects leave orphaned proposals in the database.
Problem Statement: Database bloat from stale proposal entries.

💡 Proposed Solution
Create cron job deleting unaccepted proposals for closed projects after 30 days.

📂 Files Likely Affected
backend/src/jobs/cleanupProposals.ts

✅ Acceptance Criteria
- Deletes orphaned proposal entries older than 30 days for closed projects.
- Logs cleanup statistics.

🧪 Testing Requirements
Run cleanup job against test database records.

Category: Backend | Milestone: Milestone 2 – Automation | Complexity: Low (3 pts)
```

---

### BE-10: Redis In-Memory Caching for Frequently Read Projects
```markdown
📌 Summary
Add Redis caching layer for /api/projects list endpoints.

📖 Background & Problem
Repeated fetching of active project lists strains PostgreSQL database.
Problem Statement: Slow response times under heavy read traffic.

💡 Proposed Solution
Implement Redis caching with 60-second TTL and automatic cache invalidation on mutations.

📂 Files Likely Affected
backend/src/services/cacheService.ts
backend/src/controllers/projectController.ts

✅ Acceptance Criteria
- Caches project list responses with 60-second TTL.
- Invalidates cache automatically upon new project creation or proposal acceptance.

🧪 Testing Requirements
Measure endpoint response latency with cache hit vs miss.

Category: Backend | Milestone: Milestone 3 – Performance | Complexity: Medium (5 pts)
```

---

### BE-11: Multi-Token Pricing and Conversion Oracle Endpoint
```markdown
📌 Summary
Build endpoint fetching XLM/USDC exchange rates from Stellar DEX or CoinGecko.

📖 Background & Problem
Backend needs reliable exchange rates to calculate fiat equivalents.
Problem Statement: Missing centralized token pricing service in backend.

💡 Proposed Solution
Create pricing service querying DEX liquidity pools or CoinGecko API with fallback cache.

📂 Files Likely Affected
backend/src/services/priceOracleService.ts
backend/src/routes/prices.ts

✅ Acceptance Criteria
- Returns token prices in USD with 5-minute fallback caching.

🧪 Testing Requirements
Verify price response format and fallback cache execution.

Category: Backend | Milestone: Milestone 2 – Core API | Complexity: Low (3 pts)
```

---

### BE-12: JWT / Signature Verification Middleware for Sensitive Endpoints
```markdown
📌 Summary
Create middleware requiring signed wallet challenge headers to authenticate POST requests.

📖 Background & Problem
REST API endpoints currently rely on unauthenticated wallet parameter passing.
Problem Statement: Unauthorized users could forge request payloads for arbitrary wallet addresses.

💡 Proposed Solution
Implement ed25519 signature verification middleware checking signed challenge nonces.

📂 Files Likely Affected
backend/src/middleware/authWallet.ts

✅ Acceptance Criteria
- Verifies ed25519 signature against claimed Stellar public key.
- Rejects expired or replay signatures.

🧪 Testing Requirements
Send valid and invalid wallet signatures and verify access control.

Category: Backend | Milestone: Milestone 1 – Security | Complexity: High (8 pts)
```

---

### BE-13: Project Analytics and Metrics Aggregation Endpoint
```markdown
📌 Summary
Add analytics endpoint returning total platform volume, active escrow value, and yield earned.

📖 Background & Problem
Landing page and admin views need platform-wide aggregate metrics.
Problem Statement: No aggregated analytics endpoint available.

💡 Proposed Solution
Build /api/analytics route compiling database stats into single cached JSON payload.

📂 Files Likely Affected
backend/src/controllers/analyticsController.ts
backend/src/routes/analytics.ts

✅ Acceptance Criteria
- Returns aggregated platform metrics in single JSON response.

🧪 Testing Requirements
Call /api/analytics and verify calculated totals against database rows.

Category: Backend | Milestone: Milestone 2 – Analytics | Complexity: Medium (5 pts)
```

---

### BE-14: Database Migration Rollback Scripts and Integration Tests
```markdown
📌 Summary
Create automated test suite for database migrations ensuring clean forward and rollback execution.

📖 Background & Problem
Database migrations are applied manually without automated rollback validation.
Problem Statement: Risk of broken database migrations in production deployments.

💡 Proposed Solution
Build migration test runner executing SQL migrations up and down in isolated test container.

📂 Files Likely Affected
backend/src/test/migrations.test.ts

✅ Acceptance Criteria
- All migrations execute without SQL errors.
- Test runner verifies database schema matches expected state post-migration.

🧪 Testing Requirements
Run migration test suite with npm test.

Category: Backend | Milestone: Milestone 2 – Testing | Complexity: Medium (5 pts)
```

---

### BE-15: File Upload Security Scanner and MIME Validation
```markdown
📌 Summary
Add server-side magic byte inspection and size verification for uploaded project attachments.

📖 Background & Problem
File uploader relies solely on client-side file extension checking.
Problem Statement: Vulnerable to malicious file uploads with spoofed extensions.

💡 Proposed Solution
Implement file inspector checking binary magic bytes before streaming to storage.

📂 Files Likely Affected
backend/src/utils/fileSecurity.ts

✅ Acceptance Criteria
- Rejects executable files (.exe, .sh, .bat) regardless of file extension.
- Limits file uploads to strict white-listed MIME types.

🧪 Testing Requirements
Attempt uploading executable file renamed to .pdf and verify rejection.

Category: Backend | Milestone: Milestone 2 – Security | Complexity: Medium (5 pts)
```

---

## 🔗 Fullstack & Smart Contract Issues (15)

### FS-01: Soroban Contract: Implement On-Chain Ledger Timestamp Auto-Release
```markdown
📌 Summary
Add on-chain timelock functionality to Soroban contract allowing freelancers to claim milestone funds.

📖 Background & Problem
If a client becomes inactive after milestone submission, freelancer funds remain locked indefinitely.
Problem Statement: Freelancers risk locked capital if clients fail to review submitted work.

💡 Proposed Solution
Add timelock_deadline to Milestone struct and implement claim_timelock_release contract function.

📂 Files Likely Affected
contracts/trustpay-escrow/src/lib.rs
frontend/src/lib/stellar.ts

✅ Acceptance Criteria
- Adds timelock_deadline to Milestone struct in Rust.
- Implements claim_timelock_release contract function.
- Frontend shows "Claim Timelock" button when deadline passes.

🧪 Testing Requirements
Write Soroban test simulating ledger timestamp advancement past deadline.

Category: Smart Contract | Milestone: Milestone 1 – Core Features | Complexity: High (8 pts)
```

---

### FS-02: Soroban Contract: Add Multi-Arbiter Threshold Voting for Disputes
```markdown
📌 Summary
Upgrade dispute resolution logic from single arbiter to 2-of-3 multi-signature consensus.

📖 Background & Problem
A single arbiter address represents a single point of failure in dispute arbitration.
Problem Statement: Risk of arbiter bias or compromise in high-value disputes.

💡 Proposed Solution
Modify contract state to record arbiter votes and execute payout only when threshold is reached.

📂 Files Likely Affected
contracts/trustpay-escrow/src/lib.rs
frontend/src/components/ArbiterModal.tsx

✅ Acceptance Criteria
- Contract tracks votes from multiple arbiters before executing dispute payout.
- Frontend displays voting progress bar for dispute cases.

🧪 Testing Requirements
Test dispute resolution with matching vs conflicting arbiter votes in Rust unit tests.

Category: Smart Contract | Milestone: Milestone 3 – Governance | Complexity: High (8 pts)
```

---

### FS-03: Blend Yield Optimization Integration: On-Chain Accrual and Payout
```markdown
📌 Summary
Wire accrue_yield contract logic with off-chain Blend liquidity pool yield calculations.

📖 Background & Problem
Yield optimization parameters exist in contract state but require active accrual integration.
Problem Statement: Escrowed principal does not dynamically accrue yield from liquidity pools.

💡 Proposed Solution
Build off-chain yield manager service invoking accrue_yield and update frontend yield metrics card.

📂 Files Likely Affected
contracts/trustpay-escrow/src/lib.rs
backend/src/jobs/yieldCron.ts
frontend/src/components/YieldCard.tsx

✅ Acceptance Criteria
- Cron updates accrued yield on active contract instances.
- On project completion, 70% of yield transfers to client and 30% to platform.

🧪 Testing Requirements
Test yield distribution calculations upon project completion.

Category: Fullstack | Milestone: Milestone 2 – DeFi Integration | Complexity: High (8 pts)
```

---

### FS-04: Implement Persistent In-App Project Comments and Activity Thread
```markdown
📌 Summary
Build real-time messaging and discussion tab inside each project workspace.

📖 Background & Problem
Clients and freelancers must use third-party messaging platforms to discuss deliverables.
Problem Statement: Context switching and lack of project discussion record.

💡 Proposed Solution
Add comments database table and frontend discussion tab supporting real-time messaging.

📂 Files Likely Affected
frontend/src/components/ProjectDiscussionTab.tsx
backend/src/controllers/commentController.ts
supabase/migrations/0011_comments_table.sql

✅ Acceptance Criteria
- Messages persist in Supabase and update in real-time.
- Wallet addresses are verified before posting messages.

🧪 Testing Requirements
Send test messages and verify real-time update across browser tabs.

Category: Fullstack | Milestone: Milestone 2 – Workspace | Complexity: Medium (5 pts)
```

---

### FS-05: Soroban Contract: Support Native XLM and SAC Token Escrows
```markdown
📌 Summary
Extend Soroban contract token authorization to support both wrapped native XLM and SAC tokens.

📖 Background & Problem
Contract initialization currently hardcodes token client transfers for single asset type.
Problem Statement: Users cannot select between XLM or custom SAC tokens when creating projects.

💡 Proposed Solution
Update create_project contract method to handle token authorization for arbitrary SAC assets.

📂 Files Likely Affected
contracts/trustpay-escrow/src/lib.rs
frontend/src/components/CreateProjectModal.tsx

✅ Acceptance Criteria
- Contract accepts native XLM address or custom SAC asset addresses.
- Frontend currency dropdown lets client choose asset token upon creation.

🧪 Testing Requirements
Deploy contract on testnet and create project using native XLM and USDC tokens.

Category: Smart Contract | Milestone: Milestone 1 – Core Contract | Complexity: Medium (5 pts)
```

---

### FS-06: Contract Transaction Simulation and Gas Fee Estimator
```markdown
📌 Summary
Add pre-flight simulation before submitting Soroban contract transactions to show gas fee estimates.

📖 Background & Problem
Users sign transactions without knowing the exact CPU/mem gas fee cost in XLM.
Problem Statement: Missing pre-signature transaction cost transparency.

💡 Proposed Solution
Run RPC transaction simulation prior to wallet signing and display fee breakdown modal.

📂 Files Likely Affected
frontend/src/lib/stellar.ts
frontend/src/components/TxSummaryModal.tsx

✅ Acceptance Criteria
- Runs RPC simulation on create_project or approve_milestone.
- Displays fee breakdown in XLM before prompting Freighter signature.

🧪 Testing Requirements
Simulate contract invocation and verify estimated fee matches ledger execution.

Category: Fullstack | Milestone: Milestone 2 – Web3 UX | Complexity: Medium (5 pts)
```

---

### FS-07: End-to-End Testnet Demo Seed and Automated Script
```markdown
📌 Summary
Create automated CLI script generating funded testnet wallets and running full milestone lifecycle.

📖 Background & Problem
Testing the complete client/freelancer flow manually takes significant time.
Problem Statement: Lack of automated end-to-end testnet demonstration script.

💡 Proposed Solution
Write TypeScript CLI script funding Alice/Bob identities, deploying contract, and executing all methods.

📂 Files Likely Affected
scripts/demo-e2e.ts
package.json

✅ Acceptance Criteria
- Runs with single command npm run demo:e2e.
- Outputs transaction hashes and finalized account balances.

🧪 Testing Requirements
Run npm run demo:e2e against Stellar Testnet and verify clean completion.

Category: Fullstack | Milestone: Milestone 1 – Developer Tooling | Complexity: Medium (5 pts)
```

---

### FS-08: Milestone Proof-of-Work File Hashing On-Chain
```markdown
📌 Summary
Allow freelancers to submit SHA-256 hash of deliverable files on-chain during submit_milestone.

📖 Background & Problem
Deliverable files stored off-chain could theoretically be altered post-submission.
Problem Statement: Missing immutable cryptographic proof of submitted work.

💡 Proposed Solution
Compute SHA-256 hash of deliverable files client-side and record hash in Soroban contract state.

📂 Files Likely Affected
contracts/trustpay-escrow/src/lib.rs
frontend/src/components/SubmitMilestoneModal.tsx

✅ Acceptance Criteria
- Frontend computes SHA-256 hash of deliverable file before upload.
- Hash is stored in Soroban contract state alongside milestone index.

🧪 Testing Requirements
Verify computed file hash matches on-chain contract state.

Category: Smart Contract | Milestone: Milestone 2 – Security | Complexity: Medium (5 pts)
```

---

### FS-09: Multi-Sig Client Wallet Support (SEP-0007 / Freighter Multi-Sig)
```markdown
📌 Summary
Support corporate client accounts requiring multi-signature approval from team members.

📖 Background & Problem
Corporate clients with multi-sig Stellar accounts cannot sign single-key web transactions easily.
Problem Statement: Platform fails when client address has threshold signers configured.

💡 Proposed Solution
Integrate SEP-0007 transaction URI / multi-sig payload collection flow in frontend.

📂 Files Likely Affected
frontend/src/lib/stellar.ts
frontend/src/hooks/useMultiSig.ts

✅ Acceptance Criteria
- Detects multi-sig requirements on client address.
- Supports collecting partial signatures before broadcasting to Stellar ledger.

🧪 Testing Requirements
Test transaction signing using a 2-of-2 threshold Stellar testnet account.

Category: Fullstack | Milestone: Milestone 3 – Enterprise Features | Complexity: High (8 pts)
```

---

### FS-10: Soroban Contract: Emergency Pause and Admin Safety Circuit Breaker
```markdown
📌 Summary
Add emergency admin circuit breaker mechanism to pause contract operations.

📖 Background & Problem
If an unexpected vulnerability is discovered, there is no way to temporarily halt deposits.
Problem Statement: Missing emergency pause mechanism in smart contract.

💡 Proposed Solution
Add paused flag to contract storage and require_not_paused assertion on state-changing methods.

📂 Files Likely Affected
contracts/trustpay-escrow/src/lib.rs

✅ Acceptance Criteria
- Admin address can invoke set_paused(true).
- All state-changing methods reject execution while paused.

🧪 Testing Requirements
Test contract method invocations in paused vs unpaused state in Rust tests.

Category: Smart Contract | Milestone: Milestone 2 – Security | Complexity: Medium (5 pts)
```

---

### FS-11: Freelancer Portfolio and Verified Rating System
```markdown
📌 Summary
Build on-chain verified rating system where clients leave 1-5 star reviews upon project completion.

📖 Background & Problem
Freelancers have no verifiable reputation score based on completed escrow contracts.
Problem Statement: Missing trust and rating metrics for freelancers.

💡 Proposed Solution
Add ratings table and post-completion review modal allowing clients to rate finished projects.

📂 Files Likely Affected
frontend/src/components/RatingModal.tsx
backend/src/controllers/userController.ts
supabase/migrations/0012_ratings_table.sql

✅ Acceptance Criteria
- Ratings can only be submitted for completed projects with approved milestones.
- Freelancer profile displays average rating and verified project count.

🧪 Testing Requirements
Submit review for completed project and verify profile rating update.

Category: Fullstack | Milestone: Milestone 2 – Reputation | Complexity: Medium (5 pts)
```

---

### FS-12: Partial Refund / Contract Cancellation Flow
```markdown
📌 Summary
Allow client and freelancer to mutually agree on early project termination.

📖 Background & Problem
If both parties agree to cancel a project early, they must currently trigger a dispute.
Problem Statement: No mutual cancellation path without arbiter intervention.

💡 Proposed Solution
Implement mutual cancellation method in contract returning unapproved milestone funds to client.

📂 Files Likely Affected
contracts/trustpay-escrow/src/lib.rs
frontend/src/components/CancelProjectModal.tsx

✅ Acceptance Criteria
- Requires signatures from both Client and Freelancer.
- Refund transfers remaining locked escrow funds back to client.

🧪 Testing Requirements
Test mutual cancellation execution in Rust unit tests.

Category: Smart Contract | Milestone: Milestone 2 – Core Features | Complexity: Medium (5 pts)
```

---

### FS-13: Web3 Wallet Sign-in with Ethereum / Stellar (SIWE / SIWS Standard)
```markdown
📌 Summary
Implement cryptographic challenge-response login standard (Sign-In With Stellar) for API auth.

📖 Background & Problem
API authentication currently relies on unverified wallet address passing in HTTP headers.
Problem Statement: Lack of cryptographically secure wallet session authentication.

💡 Proposed Solution
Build SIWS challenge nonce endpoint and wallet signature verification middleware issuing JWT.

📂 Files Likely Affected
frontend/src/lib/siws.ts
backend/src/middleware/authWallet.ts

✅ Acceptance Criteria
- Frontend requests challenge nonce from backend and prompts wallet signature.
- Backend verifies signature and issues short-lived JWT cookie.

🧪 Testing Requirements
Authenticate with valid wallet signature and verify JWT issuance.

Category: Fullstack | Milestone: Milestone 1 – Security | Complexity: High (8 pts)
```

---

### FS-14: Interactive Contract Event Indexer and GraphQL / REST Explorer
```markdown
📌 Summary
Expose indexed API endpoint allowing external developers to query historical escrow stats.

📖 Background & Problem
Third-party analytics tools cannot query platform stats without scanning the entire Stellar ledger.
Problem Statement: Missing indexed API for external ecosystem analytics.

💡 Proposed Solution
Build event indexer populating historical analytics table exposed via REST API route.

📂 Files Likely Affected
backend/src/controllers/indexerController.ts
backend/src/routes/indexer.ts

✅ Acceptance Criteria
- Supports filtering events by project ID, client address, and milestone state.

🧪 Testing Requirements
Query indexer endpoint and verify response schema matches historical database records.

Category: Fullstack | Milestone: Milestone 3 – Developer Tooling | Complexity: High (8 pts)
```

---

### FS-15: Soroban Contract: Optimistic Auto-Approval with Challenge Period
```markdown
📌 Summary
Implement optimistic milestone approval where work is automatically approved after 7 days.

📖 Background & Problem
Clients sometimes forget to click approve even when satisfied with deliverable.
Problem Statement: Manual approval step causes unnecessary payout delays.

💡 Proposed Solution
Store submitted_at timestamp on milestone submission and allow freelancer claim after 7 days without dispute.

📂 Files Likely Affected
contracts/trustpay-escrow/src/lib.rs
frontend/src/components/MilestoneTracker.tsx

✅ Acceptance Criteria
- Milestone stores submitted_at ledger timestamp.
- claim_optimistic_approval releases funds if 7 days elapse without client challenge.

🧪 Testing Requirements
Test optimistic approval claim before vs after 7-day challenge window in Rust tests.

Category: Smart Contract | Milestone: Milestone 2 – Core Contract | Complexity: Medium (5 pts)
```
