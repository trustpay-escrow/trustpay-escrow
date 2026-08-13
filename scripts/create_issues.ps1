# TrustPay Escrow — Automated GitHub Issues Publisher for Drip Wave

Write-Host "[+] Starting automated creation of 45 Drip Wave issues..." -ForegroundColor Green

# Ensure gh is authenticated
gh auth status
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] GitHub CLI is not authenticated. Please run 'gh auth login' first." -ForegroundColor Red
    exit 1
}

# 1. Create required repository labels first
$labels = @(
    @{name="frontend"; color="1d76db"; description="Frontend UI & Next.js tasks"},
    @{name="backend"; color="0052cc"; description="Express API & Node.js tasks"},
    @{name="smart-contract"; color="5319e7"; description="Soroban Rust contract tasks"},
    @{name="fullstack"; color="7f8c8d"; description="Fullstack integration tasks"},
    @{name="drip-wave"; color="f9d0c4"; description="Drip Wave ecosystem tasks"},
    @{name="enhancement"; color="a2eeef"; description="New feature or request"},
    @{name="good-first-issue"; color="7057ff"; description="Good for newcomers"},
    @{name="ux"; color="d4c5f9"; description="User experience improvements"},
    @{name="ui"; color="bfd4f2"; description="User interface visual updates"},
    @{name="mobile"; color="c2e0c6"; description="Mobile responsiveness tasks"},
    @{name="reliability"; color="d93f0b"; description="Error handling & stability"},
    @{name="cron"; color="fef2c0"; description="Scheduled jobs & background tasks"},
    @{name="security"; color="b60205"; description="Security & validation tasks"},
    @{name="database"; color="fbca04"; description="Database migrations & schema"},
    @{name="observability"; color="006b75"; description="Logging & metrics"},
    @{name="stellar"; color="1e88e5"; description="Stellar network & RPC tasks"},
    @{name="notifications"; color="e99695"; description="Email & webhook alerts"},
    @{name="performance"; color="d4c5f9"; description="Performance optimization"},
    @{name="testing"; color="c5def5"; description="Unit & integration testing"}
)

Write-Host "[+] Ensuring repository labels exist on GitHub..." -ForegroundColor Yellow
foreach ($lbl in $labels) {
    gh label create $lbl.name --color $lbl.color --description $lbl.description --force 2>$null
}

# 2. Issues Data Array
$issues = @(
    # --- Frontend Issues (15) ---
    @{
        title = '[FEAT]: Interactive Milestone Progress and Payout Calculator';
        body = "📌 Summary`nAdd dynamic visual progress bar and payout calculator widget on Project Details page.`n`n📖 Background & Problem`nClients and freelancers lack real-time visual feedback on remaining locked escrow funds vs approved payouts.`nProblem Statement: Hard to track remaining project balance and projected yield at a glance.`n`n💡 Proposed Solution`nBuild interactive progress bar component calculating approved USDC, locked USDC, and estimated Blend yield.`n`n📂 Files Likely Affected`nfrontend/src/app/projects/[id]/page.tsx`nfrontend/src/components/MilestoneTracker.tsx`n`n✅ Acceptance Criteria`n- Progress bar dynamically updates based on milestone states (Pending, Submitted, Approved).`n- Displays total paid USDC, locked USDC, and estimated Blend yield.`n`n🧪 Testing Requirements`nMock milestone states and test rendering across various budget splits.`n`nCategory: Frontend | Milestone: Milestone 1 – Core Features | Complexity: Medium (5 pts)";
        labels = 'frontend,drip-wave,enhancement'
    },
    @{
        title = '[FEAT]: Advanced Filter and Search for Client/Freelancer Dashboards';
        body = "📌 Summary`nEnhance dashboard view with multi-criteria filtering and real-time search.`n`n📖 Background & Problem`nUsers with multiple active projects struggle to find specific projects.`nProblem Statement: No search or status filter on project list views.`n`n💡 Proposed Solution`nAdd filter controls for status, date range, client address, and budget threshold with URL query sync.`n`n📂 Files Likely Affected`nfrontend/src/components/ClientDashboard.tsx`nfrontend/src/components/FreelancerDashboard.tsx`n`n✅ Acceptance Criteria`n- Real-time search filter without full page reloads.`n- URL query state sync (e.g. ?status=active&search=website).`n`n🧪 Testing Requirements`nVerify filter logic with empty results and multi-select combinations.`n`nCategory: Frontend | Milestone: Milestone 1 – Core Features | Complexity: Low (3 pts)";
        labels = 'frontend,drip-wave,good-first-issue'
    },
    @{
        title = '[FEAT]: Toast Notification System for Stellar Wallet Signature States';
        body = "📌 Summary`nProvide feedback toasts during transaction signing and submission phases.`n`n📖 Background & Problem`nUsers are confused while waiting for Freighter wallet signatures or ledger confirmation.`nProblem Statement: Lack of visual progress feedback during web3 transaction lifecycles.`n`n💡 Proposed Solution`nImplement toast component showing signing, broadcasting, confirmation, and failure states with StellarExpert links.`n`n📂 Files Likely Affected`nfrontend/src/hooks/useStellarTx.ts`nfrontend/src/components/Toast.tsx`n`n✅ Acceptance Criteria`n- Displays Stellar transaction hash with direct link to StellarExpert explorer.`n- Auto-dismisses on success after 5 seconds.`n`n🧪 Testing Requirements`nSimulate rejected wallet signatures and network timeouts.`n`nCategory: Frontend | Milestone: Milestone 1 – Core Features | Complexity: Medium (5 pts)";
        labels = 'frontend,drip-wave,ux'
    },
    @{
        title = '[FEAT]: Drag-and-Drop File Upload with Image Lightbox Preview';
        body = "📌 Summary`nCreate file uploader supporting drag-and-drop attachment with image lightbox preview.`n`n📖 Background & Problem`nUploading project specifications and proof of work requires clunky file inputs.`nProblem Statement: No drag-and-drop or full-resolution image preview.`n`n💡 Proposed Solution`nBuild drag-and-drop upload zone integrated with Supabase storage and a full-screen lightbox modal.`n`n📂 Files Likely Affected`nfrontend/src/components/FileUploadModal.tsx`nfrontend/src/components/ImageLightboxModal.tsx`n`n✅ Acceptance Criteria`n- File size validation (< 10MB) and file type restriction (PDF, PNG, JPG, ZIP).`n- Lightbox modal allows full-screen preview and direct download.`n`n🧪 Testing Requirements`nTest uploading invalid file extensions and large files.`n`nCategory: Frontend | Milestone: Milestone 2 – UI/UX Polish | Complexity: Medium (5 pts)";
        labels = 'frontend,drip-wave,ui'
    },
    @{
        title = '[FEAT]: Global Dark / Light Theme Switcher';
        body = "📌 Summary`nImplement theme toggle matching modern glassmorphism design system.`n`n📖 Background & Problem`nThe application currently defaults to dark mode without theme switching capability.`nProblem Statement: Users cannot toggle light mode according to preference.`n`n💡 Proposed Solution`nAdd theme context provider and toggle button storing choice in localStorage.`n`n📂 Files Likely Affected`nfrontend/src/components/ThemeToggle.tsx`nfrontend/src/app/globals.css`n`n✅ Acceptance Criteria`n- Persists preference in localStorage and respects system prefers-color-scheme.`n- Zero layout shift during theme transition.`n`n🧪 Testing Requirements`nVerify toggle state across browser reloads.`n`nCategory: Frontend | Milestone: Milestone 2 – UI/UX Polish | Complexity: Low (2 pts)";
        labels = 'frontend,drip-wave,good-first-issue'
    },
    @{
        title = '[FEAT]: Responsive Mobile Navigation Drawer and Wallet Switcher';
        body = "📌 Summary`nBuild smooth sliding mobile navigation drawer with role switcher and wallet disconnect.`n`n📖 Background & Problem`nNavigation controls wrap awkwardly on mobile devices below 480px width.`nProblem Statement: Poor mobile layout UX for top navbar actions.`n`n💡 Proposed Solution`nCreate responsive slide-over drawer containing menu links, active role toggle, and wallet status.`n`n📂 Files Likely Affected`nfrontend/src/components/Navbar.tsx`nfrontend/src/components/MobileDrawer.tsx`n`n✅ Acceptance Criteria`n- Touch-friendly hamburger menu triggers slide-over drawer.`n- Tested across screen widths down to 360px.`n`n🧪 Testing Requirements`nTest open/close animations and breakpoint triggers on mobile viewports.`n`nCategory: Frontend | Milestone: Milestone 2 – Mobile Responsiveness | Complexity: Medium (5 pts)";
        labels = 'frontend,drip-wave,mobile'
    },
    @{
        title = '[FEAT]: Form Validation and Auto-Save Drafts for Project Creation';
        body = "📌 Summary`nAdd Zod schema validation to project creation forms and auto-save progress.`n`n📖 Background & Problem`nAccidentally refreshing the project creation modal loses all typed milestone details.`nProblem Statement: No draft persistence or pre-submission input validation.`n`n💡 Proposed Solution`nValidate form inputs with Zod and save form draft state to sessionStorage.`n`n📂 Files Likely Affected`nfrontend/src/hooks/useCreateProjectForm.ts`nfrontend/src/components/CreateProjectModal.tsx`n`n✅ Acceptance Criteria`n- Shows clear inline error messages for invalid wallet addresses, negative amounts, or past due dates.`n- Restores draft automatically if page is refreshed.`n`n🧪 Testing Requirements`nSubmit invalid payloads and verify error messages.`n`nCategory: Frontend | Milestone: Milestone 1 – Core Features | Complexity: Low (3 pts)";
        labels = 'frontend,drip-wave,ux'
    },
    @{
        title = '[FEAT]: Milestone Delivery Verification Modal with Code/Link Submission';
        body = "📌 Summary`nProvide freelancers structured submission modal to attach PR links and demo URLs.`n`n📖 Background & Problem`nSubmitting a milestone currently lacks a dedicated interface to attach proof of work.`nProblem Statement: Freelancers cannot attach pull request links or notes when marking milestone submitted.`n`n💡 Proposed Solution`nBuild submission modal prompting for deliverable description, PR link, and live demo URL.`n`n📂 Files Likely Affected`nfrontend/src/components/SubmitMilestoneModal.tsx`n`n✅ Acceptance Criteria`n- Validates URL syntax for GitHub PRs and demo links.`n- Triggers Soroban submit_milestone transaction upon form submission.`n`n🧪 Testing Requirements`nVerify form submission and contract call trigger.`n`nCategory: Frontend | Milestone: Milestone 1 – Core Features | Complexity: Medium (5 pts)";
        labels = 'frontend,drip-wave'
    },
    @{
        title = '[FEAT]: On-Chain Transaction History Log Component';
        body = "📌 Summary`nCreate audit trail component displaying historical contract calls for a project.`n`n📖 Background & Problem`nUsers cannot view the complete chronological sequence of contract transactions.`nProblem Statement: On-chain project events are hidden from the UI.`n`n💡 Proposed Solution`nBuild transaction history tab fetching and listing contract operations with block explorer links.`n`n📂 Files Likely Affected`nfrontend/src/components/ProjectHistoryTab.tsx`n`n✅ Acceptance Criteria`n- Displays timestamp, calling wallet address, operation type, and Stellar block explorer links.`n`n🧪 Testing Requirements`nVerify history rendering for active and completed projects.`n`nCategory: Frontend | Milestone: Milestone 2 – Audit & Analytics | Complexity: Medium (5 pts)";
        labels = 'frontend,drip-wave'
    },
    @{
        title = '[FEAT]: Interactive Proposal Bidding List and Accept/Reject UI';
        body = "📌 Summary`nCreate client workspace view to inspect freelancer proposals and trigger single-click acceptance.`n`n📖 Background & Problem`nClients cannot compare candidate proposals directly inside the project details page.`nProblem Statement: Missing proposal management dashboard view for clients.`n`n💡 Proposed Solution`nAdd proposals tab to project workspace rendering applicant cover notes, portfolio links, and Accept/Deny actions.`n`n📂 Files Likely Affected`nfrontend/src/components/ProposalsList.tsx`n`n✅ Acceptance Criteria`n- Client can accept a proposal, binding freelancer address and updating project status.`n- Provides confirmation modal before denying competing proposals.`n`n🧪 Testing Requirements`nTest proposal acceptance and denial state changes.`n`nCategory: Frontend | Milestone: Milestone 1 – Core Features | Complexity: High (8 pts)";
        labels = 'frontend,drip-wave'
    },
    @{
        title = '[FEAT]: Custom Loading Skeleton Screens across All Views';
        body = "📌 Summary`nReplace generic loading spinners with CSS skeleton loaders matching card layouts.`n`n📖 Background & Problem`nSpinner loaders cause abrupt layout shifts when data finishes loading.`nProblem Statement: Poor perceived performance during initial RPC and database fetches.`n`n💡 Proposed Solution`nCreate pulse-animated skeleton loader components mirroring project cards and table rows.`n`n📂 Files Likely Affected`nfrontend/src/components/skeletons/ProjectCardSkeleton.tsx`n`n✅ Acceptance Criteria`n- Pulse animation implemented using pure CSS.`n- Applied to dashboards, project detail pages, and proposal lists.`n`n🧪 Testing Requirements`nInspect visual transition from loading state to populated data.`n`nCategory: Frontend | Milestone: Milestone 2 – UI/UX Polish | Complexity: Low (2 pts)";
        labels = 'frontend,drip-wave,good-first-issue'
    },
    @{
        title = '[FEAT]: Export Project Report as PDF / JSON';
        body = "📌 Summary`nAdd export button to generate downloadable PDF audit receipt containing project summary.`n`n📖 Background & Problem`nFreelancers and clients need official documentation of escrow payouts for tax/accounting.`nProblem Statement: No downloadable export or receipt functionality.`n`n💡 Proposed Solution`nIntegrate PDF generation library to create summary document with milestone payout hashes and timestamps.`n`n📂 Files Likely Affected`nfrontend/src/components/ExportReceiptButton.tsx`nfrontend/src/lib/pdfGenerator.ts`n`n✅ Acceptance Criteria`n- PDF includes client address, freelancer address, total amount, milestone breakdown, and timestamp.`n`n🧪 Testing Requirements`nGenerate PDF report and verify data accuracy against on-chain records.`n`nCategory: Frontend | Milestone: Milestone 3 – Enterprise Features | Complexity: Medium (5 pts)";
        labels = 'frontend,drip-wave'
    },
    @{
        title = '[FEAT]: React Error Boundaries with Fallback Recovery';
        body = "📌 Summary`nWrap major application routes with React Error Boundaries to prevent full app crashes.`n`n📖 Background & Problem`nUncaught RPC errors or missing props cause the entire Next.js app to render a blank screen.`nProblem Statement: Weak runtime error resilience in production.`n`n💡 Proposed Solution`nImplement ErrorBoundary component rendering friendly recovery fallback with 'Retry Connection' button.`n`n📂 Files Likely Affected`nfrontend/src/components/ErrorBoundary.tsx`nfrontend/src/app/layout.tsx`n`n✅ Acceptance Criteria`n- Renders user-friendly error card with 'Retry Connection' button.`n- Logs unhandled errors silently to console.`n`n🧪 Testing Requirements`nThrow artificial render error and verify fallback UI.`n`nCategory: Frontend | Milestone: Milestone 2 – Reliability | Complexity: Low (3 pts)";
        labels = 'frontend,drip-wave,reliability'
    },
    @{
        title = '[FEAT]: Multi-Currency Display (USDC, XLM, USD Equivalent)';
        body = "📌 Summary`nDisplay real-time fiat USD conversion estimates next to XLM and USDC amounts.`n`n📖 Background & Problem`nUsers struggle to mentally convert XLM/USDC token amounts into fiat USD value.`nProblem Statement: Prices displayed purely in crypto units without fiat reference.`n`n💡 Proposed Solution`nCreate currency converter hook fetching DEX/CoinGecko rates and rendering formatted USD equivalents.`n`n📂 Files Likely Affected`nfrontend/src/components/CurrencyDisplay.tsx`nfrontend/src/hooks/useTokenPrice.ts`n`n✅ Acceptance Criteria`n- Fetches token price every 60 seconds with fallback caching.`n- Shows formatted fiat values (e.g. $1,250.00 USD).`n`n🧪 Testing Requirements`nTest API price fetching and fallback formatting when offline.`n`nCategory: Frontend | Milestone: Milestone 2 – UI/UX Polish | Complexity: Medium (5 pts)";
        labels = 'frontend,drip-wave'
    },
    @{
        title = '[FEAT]: Interactive Onboarding Tour for First-Time Users';
        body = "📌 Summary`nBuild step-by-step guided tour highlighting wallet connection and project workflows.`n`n📖 Background & Problem`nNew users entering the platform are unsure how escrow deposits and milestone approvals work.`nProblem Statement: High initial user drop-off due to missing onboarding guidance.`n`n💡 Proposed Solution`nBuild interactive tooltip tour guiding users through wallet connection, project creation, and dashboard switching.`n`n📂 Files Likely Affected`nfrontend/src/components/OnboardingTour.tsx`n`n✅ Acceptance Criteria`n- Tour triggers only on first visit (tracked via localStorage).`n- User can skip or restart tour anytime from footer.`n`n🧪 Testing Requirements`nVerify localStorage flag and tour step transitions.`n`nCategory: Frontend | Milestone: Milestone 2 – UI/UX Polish | Complexity: Medium (5 pts)";
        labels = 'frontend,drip-wave,ux'
    },

    # --- Backend Issues (15) ---
    @{
        title = '[FEAT]: Zod API Payload Validation Middleware across All Routes';
        body = "📌 Summary`nCreate strict Zod schema validation middleware for all POST/PUT endpoints.`n`n📖 Background & Problem`nIncoming HTTP request bodies are not rigorously validated before reaching controllers.`nProblem Statement: Potential payload injection or malformed data reaching database.`n`n💡 Proposed Solution`nImplement generic validation middleware verifying request params, query, and body against Zod schemas.`n`n📂 Files Likely Affected`nbackend/src/middleware/validate.ts`nbackend/src/routes/projects.ts`n`n✅ Acceptance Criteria`n- Returns HTTP 400 with structured JSON error details on invalid inputs.`n- Rejects extra or unrecognized keys.`n`n🧪 Testing Requirements`nSend malformed JSON payloads to API routes and verify HTTP 400 response.`n`nCategory: Backend | Milestone: Milestone 1 – Core API | Complexity: Medium (5 pts)";
        labels = 'backend,drip-wave,security'
    },
    @{
        title = '[FEAT]: Rate Limiting Middleware for Public REST Endpoints';
        body = "📌 Summary`nAdd express-rate-limit to prevent spam on public API routes.`n`n📖 Background & Problem`nPublic endpoints like proposal submissions can be spammed by automated scripts.`nProblem Statement: API vulnerable to abuse and denial of service.`n`n💡 Proposed Solution`nConfigure express-rate-limit middleware with IP-based window limits.`n`n📂 Files Likely Affected`nbackend/src/middleware/rateLimiter.ts`nbackend/src/server.ts`n`n✅ Acceptance Criteria`n- Limits requests to 100 requests per 15 minutes per IP address.`n- Returns HTTP 429 Too Many Requests with Retry-After header.`n`n🧪 Testing Requirements`nExecute rapid automated requests and verify rate limit response.`n`nCategory: Backend | Milestone: Milestone 1 – Security | Complexity: Low (3 pts)";
        labels = 'backend,drip-wave,security'
    },
    @{
        title = '[FEAT]: Enhance Automated Auto-Release Cron Job with Timelock Retries';
        body = "📌 Summary`nUpgrade auto-release cron service with exponential backoff retries.`n`n📖 Background & Problem`nTemporary Horizon RPC network congestion can cause scheduled auto-releases to fail silently.`nProblem Statement: Failed cron runs do not retry automatically.`n`n💡 Proposed Solution`nImplement retry mechanism with exponential backoff for Stellar contract simulation and execution.`n`n📂 Files Likely Affected`nbackend/src/services/autoReleaseService.ts`nbackend/src/jobs/autoReleaseCron.ts`n`n✅ Acceptance Criteria`n- Retries up to 3 times on RPC network timeouts.`n- Logs execution results to Supabase notifications table.`n`n🧪 Testing Requirements`nSimulate RPC failures and verify retry attempts.`n`nCategory: Backend | Milestone: Milestone 2 – Automation | Complexity: Medium (5 pts)";
        labels = 'backend,drip-wave,cron'
    },
    @{
        title = '[FEAT]: Supabase Row Level Security (RLS) Policy Audit';
        body = "📌 Summary`nWrite SQL migration enforcing strict RLS policies on database tables.`n`n📖 Background & Problem`nDatabase tables lack explicit row-level access controls for anonymous connections.`nProblem Statement: Risk of unauthorized data access or modification via Supabase client.`n`n💡 Proposed Solution`nAdd SQL migration enabling RLS and enforcing client/freelancer ownership checks.`n`n📂 Files Likely Affected`nsupabase/migrations/0010_enforce_rls_policies.sql`n`n✅ Acceptance Criteria`n- Users can only edit their own profile and proposals.`n- Clients can only update projects they created.`n`n🧪 Testing Requirements`nExecute SQL queries as unauthorized role and verify access rejection.`n`nCategory: Backend | Milestone: Milestone 1 – Security | Complexity: High (8 pts)";
        labels = 'backend,drip-wave,security'
    },
    @{
        title = '[FEAT]: Comprehensive Structured Logging with Winston / Pino';
        body = "📌 Summary`nReplace console.log statements with structured JSON logger supporting log levels.`n`n📖 Background & Problem`nCurrent console logging lacks structured format, making production debugging difficult.`nProblem Statement: Unstructured logs make searching and error tracking difficult.`n`n💡 Proposed Solution`nIntegrate Winston logger with JSON formatting, log levels, and request correlation IDs.`n`n📂 Files Likely Affected`nbackend/src/utils/logger.ts`nbackend/src/middleware/requestLogger.ts`n`n✅ Acceptance Criteria`n- Outputs structured JSON format with timestamp and route metadata.`n- Excludes sensitive wallet private keys or authorization headers.`n`n🧪 Testing Requirements`nTrigger server errors and inspect output log schema.`n`nCategory: Backend | Milestone: Milestone 2 – Observability | Complexity: Medium (5 pts)";
        labels = 'backend,drip-wave,observability'
    },
    @{
        title = '[FEAT]: Webhook Event Listener for Stellar Horizon Ledger Events';
        body = "📌 Summary`nBuild background worker service streaming contract event logs from Stellar Horizon RPC.`n`n📖 Background & Problem`nDatabase state updates currently rely on client-side HTTP calls after transactions.`nProblem Statement: If client browser closes before API call, database becomes out of sync with chain.`n`n💡 Proposed Solution`nImplement event stream listener capturing Soroban contract events and updating Supabase automatically.`n`n📂 Files Likely Affected`nbackend/src/services/stellarEventListener.ts`n`n✅ Acceptance Criteria`n- Listens for submit_milestone and approve_milestone contract events.`n- Syncs database state instantly without relying on client HTTP calls.`n`n🧪 Testing Requirements`nTrigger testnet contract invocation and verify database sync.`n`nCategory: Backend | Milestone: Milestone 2 – Infrastructure | Complexity: High (8 pts)";
        labels = 'backend,drip-wave,stellar'
    },
    @{
        title = '[FEAT]: Email / Discord Notification Service via Resend / Webhooks';
        body = "📌 Summary`nAdd email or Discord webhook alerts when milestone work is submitted or disputed.`n`n📖 Background & Problem`nClients must manually refresh the dashboard to check if a freelancer submitted work.`nProblem Statement: Missing real-time off-platform push notifications.`n`n💡 Proposed Solution`nIntegrate Resend email API or Discord webhook dispatcher triggered on milestone events.`n`n📂 Files Likely Affected`nbackend/src/services/emailService.ts`nbackend/src/controllers/notificationController.ts`n`n✅ Acceptance Criteria`n- Sends email alert to client when freelancer submits milestone work.`n- Supports configurable notification settings in user profile.`n`n🧪 Testing Requirements`nTrigger notification event and verify email delivery to inbox/webhook.`n`nCategory: Backend | Milestone: Milestone 2 – Notifications | Complexity: Medium (5 pts)";
        labels = 'backend,drip-wave,notifications'
    },
    @{
        title = '[FEAT]: Server Health and RPC Monitoring Endpoint';
        body = "📌 Summary`nCreate /health REST endpoint returning status of API, Supabase, and Stellar RPC.`n`n📖 Background & Problem`nDevOps monitoring lacks an endpoint to check backend service health.`nProblem Statement: Unable to perform automated health checks or uptime monitoring.`n`n💡 Proposed Solution`nBuild /health route checking DB connectivity and RPC node response latency.`n`n📂 Files Likely Affected`nbackend/src/routes/health.ts`n`n✅ Acceptance Criteria`n- Returns HTTP 200 OK when all services are responsive.`n- Returns HTTP 500 with breakdown if database or RPC is unreachable.`n`n🧪 Testing Requirements`nCall /health endpoint and verify response schema.`n`nCategory: Backend | Milestone: Milestone 1 – Core API | Complexity: Low (2 pts)";
        labels = 'backend,drip-wave,good-first-issue'
    },
    @{
        title = '[FEAT]: Automatic Cleanup Job for Stale Unaccepted Proposals';
        body = "📌 Summary`nSchedule daily background job to archive or delete unaccepted proposals.`n`n📖 Background & Problem`nCancelled or completed projects leave orphaned proposals in the database.`nProblem Statement: Database bloat from stale proposal entries.`n`n💡 Proposed Solution`nCreate cron job deleting unaccepted proposals for closed projects after 30 days.`n`n📂 Files Likely Affected`nbackend/src/jobs/cleanupProposals.ts`n`n✅ Acceptance Criteria`n- Deletes orphaned proposal entries older than 30 days for closed projects.`n- Logs cleanup statistics.`n`n🧪 Testing Requirements`nRun cleanup job against test database records.`n`nCategory: Backend | Milestone: Milestone 2 – Automation | Complexity: Low (3 pts)";
        labels = 'backend,drip-wave,cron'
    },
    @{
        title = '[FEAT]: Redis In-Memory Caching for Frequently Read Projects';
        body = "📌 Summary`nAdd Redis caching layer for /api/projects list endpoints.`n`n📖 Background & Problem`nRepeated fetching of active project lists strains PostgreSQL database.`nProblem Statement: Slow response times under heavy read traffic.`n`n💡 Proposed Solution`nImplement Redis caching with 60-second TTL and automatic cache invalidation on mutations.`n`n📂 Files Likely Affected`nbackend/src/services/cacheService.ts`nbackend/src/controllers/projectController.ts`n`n✅ Acceptance Criteria`n- Caches project list responses with 60-second TTL.`n- Invalidates cache automatically upon new project creation or proposal acceptance.`n`n🧪 Testing Requirements`nMeasure endpoint response latency with cache hit vs miss.`n`nCategory: Backend | Milestone: Milestone 3 – Performance | Complexity: Medium (5 pts)";
        labels = 'backend,drip-wave,performance'
    },
    @{
        title = '[FEAT]: Multi-Token Pricing and Conversion Oracle Endpoint';
        body = "📌 Summary`nBuild endpoint fetching XLM/USDC exchange rates from Stellar DEX or CoinGecko.`n`n📖 Background & Problem`nBackend needs reliable exchange rates to calculate fiat equivalents.`nProblem Statement: Missing centralized token pricing service in backend.`n`n💡 Proposed Solution`nCreate pricing service querying DEX liquidity pools or CoinGecko API with fallback cache.`n`n📂 Files Likely Affected`nbackend/src/services/priceOracleService.ts`nbackend/src/routes/prices.ts`n`n✅ Acceptance Criteria`n- Returns token prices in USD with 5-minute fallback caching.`n`n🧪 Testing Requirements`nVerify price response format and fallback cache execution.`n`nCategory: Backend | Milestone: Milestone 2 – Core API | Complexity: Low (3 pts)";
        labels = 'backend,drip-wave'
    },
    @{
        title = '[FEAT]: JWT / Signature Verification Middleware for Sensitive Endpoints';
        body = "📌 Summary`nCreate middleware requiring signed wallet challenge headers to authenticate POST requests.`n`n📖 Background & Problem`nREST API endpoints currently rely on unauthenticated wallet parameter passing.`nProblem Statement: Unauthorized users could forge request payloads for arbitrary wallet addresses.`n`n💡 Proposed Solution`nImplement ed25519 signature verification middleware checking signed challenge nonces.`n`n📂 Files Likely Affected`nbackend/src/middleware/authWallet.ts`n`n✅ Acceptance Criteria`n- Verifies ed25519 signature against claimed Stellar public key.`n- Rejects expired or replay signatures.`n`n🧪 Testing Requirements`nSend valid and invalid wallet signatures and verify access control.`n`nCategory: Backend | Milestone: Milestone 1 – Security | Complexity: High (8 pts)";
        labels = 'backend,drip-wave,security'
    },
    @{
        title = '[FEAT]: Project Analytics and Metrics Aggregation Endpoint';
        body = "📌 Summary`nAdd analytics endpoint returning total platform volume, active escrow value, and yield earned.`n`n📖 Background & Problem`nLanding page and admin views need platform-wide aggregate metrics.`nProblem Statement: No aggregated analytics endpoint available.`n`n💡 Proposed Solution`nBuild /api/analytics route compiling database stats into single cached JSON payload.`n`n📂 Files Likely Affected`nbackend/src/controllers/analyticsController.ts`nbackend/src/routes/analytics.ts`n`n✅ Acceptance Criteria`n- Returns aggregated platform metrics in single JSON response.`n`n🧪 Testing Requirements`nCall /api/analytics and verify calculated totals against database rows.`n`nCategory: Backend | Milestone: Milestone 2 – Analytics | Complexity: Medium (5 pts)";
        labels = 'backend,drip-wave'
    },
    @{
        title = '[FEAT]: Database Migration Rollback Scripts and Integration Tests';
        body = "📌 Summary`nCreate automated test suite for database migrations ensuring clean forward and rollback execution.`n`n📖 Background & Problem`nDatabase migrations are applied manually without automated rollback validation.`nProblem Statement: Risk of broken database migrations in production deployments.`n`n💡 Proposed Solution`nBuild migration test runner executing SQL migrations up and down in isolated test container.`n`n📂 Files Likely Affected`nbackend/src/test/migrations.test.ts`n`n✅ Acceptance Criteria`n- All migrations execute without SQL errors.`n- Test runner verifies database schema matches expected state post-migration.`n`n🧪 Testing Requirements`nRun migration test suite with npm test.`n`nCategory: Backend | Milestone: Milestone 2 – Testing | Complexity: Medium (5 pts)";
        labels = 'backend,drip-wave,testing'
    },
    @{
        title = '[FEAT]: File Upload Security Scanner and MIME Validation';
        body = "📌 Summary`nAdd server-side magic byte inspection and size verification for uploaded project attachments.`n`n📖 Background & Problem`nFile uploader relies solely on client-side file extension checking.`nProblem Statement: Vulnerable to malicious file uploads with spoofed extensions.`n`n💡 Proposed Solution`nImplement file inspector checking binary magic bytes before streaming to storage.`n`n📂 Files Likely Affected`nbackend/src/utils/fileSecurity.ts`n`n✅ Acceptance Criteria`n- Rejects executable files (.exe, .sh, .bat) regardless of file extension.`n- Limits file uploads to strict white-listed MIME types.`n`n🧪 Testing Requirements`nAttempt uploading executable file renamed to .pdf and verify rejection.`n`nCategory: Backend | Milestone: Milestone 2 – Security | Complexity: Medium (5 pts)";
        labels = 'backend,drip-wave,security'
    },

    # --- Fullstack & Smart Contract Issues (15) ---
    @{
        title = '[FEAT]: Soroban Contract: Implement On-Chain Ledger Timestamp Auto-Release';
        body = "📌 Summary`nAdd on-chain timelock functionality to Soroban contract allowing freelancers to claim milestone funds.`n`n📖 Background & Problem`nIf a client becomes inactive after milestone submission, freelancer funds remain locked indefinitely.`nProblem Statement: Freelancers risk locked capital if clients fail to review submitted work.`n`n💡 Proposed Solution`nAdd timelock_deadline to Milestone struct and implement claim_timelock_release contract function.`n`n📂 Files Likely Affected`ncontracts/trustpay-escrow/src/lib.rs`nfrontend/src/lib/stellar.ts`n`n✅ Acceptance Criteria`n- Adds timelock_deadline to Milestone struct in Rust.`n- Implements claim_timelock_release contract function.`n- Frontend shows 'Claim Timelock' button when deadline passes.`n`n🧪 Testing Requirements`nWrite Soroban test simulating ledger timestamp advancement past deadline.`n`nCategory: Smart Contract | Milestone: Milestone 1 – Core Features | Complexity: High (8 pts)";
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Soroban Contract: Add Multi-Arbiter Threshold Voting for Disputes';
        body = "📌 Summary`nUpgrade dispute resolution logic from single arbiter to 2-of-3 multi-signature consensus.`n`n📖 Background & Problem`nA single arbiter address represents a single point of failure in dispute arbitration.`nProblem Statement: Risk of arbiter bias or compromise in high-value disputes.`n`n💡 Proposed Solution`nModify contract state to record arbiter votes and execute payout only when threshold is reached.`n`n📂 Files Likely Affected`ncontracts/trustpay-escrow/src/lib.rs`nfrontend/src/components/ArbiterModal.tsx`n`n✅ Acceptance Criteria`n- Contract tracks votes from multiple arbiters before executing dispute payout.`n- Frontend displays voting progress bar for dispute cases.`n`n🧪 Testing Requirements`nTest dispute resolution with matching vs conflicting arbiter votes in Rust unit tests.`n`nCategory: Smart Contract | Milestone: Milestone 3 – Governance | Complexity: High (8 pts)";
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Blend Yield Optimization Integration: On-Chain Accrual and Payout';
        body = "📌 Summary`nWire accrue_yield contract logic with off-chain Blend liquidity pool yield calculations.`n`n📖 Background & Problem`nYield optimization parameters exist in contract state but require active accrual integration.`nProblem Statement: Escrowed principal does not dynamically accrue yield from liquidity pools.`n`n💡 Proposed Solution`nBuild off-chain yield manager service invoking accrue_yield and update frontend yield metrics card.`n`n📂 Files Likely Affected`ncontracts/trustpay-escrow/src/lib.rs`nbackend/src/jobs/yieldCron.ts`nfrontend/src/components/YieldCard.tsx`n`n✅ Acceptance Criteria`n- Cron updates accrued yield on active contract instances.`n- On project completion, 70% of yield transfers to client and 30% to platform.`n`n🧪 Testing Requirements`nTest yield distribution calculations upon project completion.`n`nCategory: Fullstack | Milestone: Milestone 2 – DeFi Integration | Complexity: High (8 pts)";
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Implement Persistent In-App Project Comments and Activity Thread';
        body = "📌 Summary`nBuild real-time messaging and discussion tab inside each project workspace.`n`n📖 Background & Problem`nClients and freelancers must use third-party messaging platforms to discuss deliverables.`nProblem Statement: Context switching and lack of project discussion record.`n`n💡 Proposed Solution`nAdd comments database table and frontend discussion tab supporting real-time messaging.`n`n📂 Files Likely Affected`nfrontend/src/components/ProjectDiscussionTab.tsx`nbackend/src/controllers/commentController.ts`nsupabase/migrations/0011_comments_table.sql`n`n✅ Acceptance Criteria`n- Messages persist in Supabase and update in real-time.`n- Wallet addresses are verified before posting messages.`n`n🧪 Testing Requirements`nSend test messages and verify real-time update across browser tabs.`n`nCategory: Fullstack | Milestone: Milestone 2 – Workspace | Complexity: Medium (5 pts)";
        labels = 'fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Soroban Contract: Support Native XLM and SAC Token Escrows';
        body = "📌 Summary`nExtend Soroban contract token authorization to support both wrapped native XLM and SAC tokens.`n`n📖 Background & Problem`nContract initialization currently hardcodes token client transfers for single asset type.`nProblem Statement: Users cannot select between XLM or custom SAC tokens when creating projects.`n`n💡 Proposed Solution`nUpdate create_project contract method to handle token authorization for arbitrary SAC assets.`n`n📂 Files Likely Affected`ncontracts/trustpay-escrow/src/lib.rs`nfrontend/src/components/CreateProjectModal.tsx`n`n✅ Acceptance Criteria`n- Contract accepts native XLM address or custom SAC asset addresses.`n- Frontend currency dropdown lets client choose asset token upon creation.`n`n🧪 Testing Requirements`nDeploy contract on testnet and create project using native XLM and USDC tokens.`n`nCategory: Smart Contract | Milestone: Milestone 1 – Core Contract | Complexity: Medium (5 pts)";
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Contract Transaction Simulation and Gas Fee Estimator';
        body = "📌 Summary`nAdd pre-flight simulation before submitting Soroban contract transactions to show gas fee estimates.`n`n📖 Background & Problem`nUsers sign transactions without knowing the exact CPU/mem gas fee cost in XLM.`nProblem Statement: Missing pre-signature transaction cost transparency.`n`n💡 Proposed Solution`nRun RPC transaction simulation prior to wallet signing and display fee breakdown modal.`n`n📂 Files Likely Affected`nfrontend/src/lib/stellar.ts`nfrontend/src/components/TxSummaryModal.tsx`n`n✅ Acceptance Criteria`n- Runs RPC simulation on create_project or approve_milestone.`n- Displays fee breakdown in XLM before prompting Freighter signature.`n`n🧪 Testing Requirements`nSimulate contract invocation and verify estimated fee matches ledger execution.`n`nCategory: Fullstack | Milestone: Milestone 2 – Web3 UX | Complexity: Medium (5 pts)";
        labels = 'fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Build End-to-End Testnet Demo Seed and Automated Script';
        body = "📌 Summary`nCreate automated CLI script generating funded testnet wallets and running full milestone lifecycle.`n`n📖 Background & Problem`nTesting the complete client/freelancer flow manually takes significant time.`nProblem Statement: Lack of automated end-to-end testnet demonstration script.`n`n💡 Proposed Solution`nWrite TypeScript CLI script funding Alice/Bob identities, deploying contract, and executing all methods.`n`n📂 Files Likely Affected`nscripts/demo-e2e.ts`npackage.json`n`n✅ Acceptance Criteria`n- Runs with single command npm run demo:e2e.`n- Outputs transaction hashes and finalized account balances.`n`n🧪 Testing Requirements`nRun npm run demo:e2e against Stellar Testnet and verify clean completion.`n`nCategory: Fullstack | Milestone: Milestone 1 – Developer Tooling | Complexity: Medium (5 pts)";
        labels = 'fullstack,drip-wave,testing'
    },
    @{
        title = '[FEAT]: Add Milestone Proof-of-Work File Hashing On-Chain';
        body = "📌 Summary`nAllow freelancers to submit SHA-256 hash of deliverable files on-chain during submit_milestone.`n`n📖 Background & Problem`nDeliverable files stored off-chain could theoretically be altered post-submission.`nProblem Statement: Missing immutable cryptographic proof of submitted work.`n`n💡 Proposed Solution`nCompute SHA-256 hash of deliverable files client-side and record hash in Soroban contract state.`n`n📂 Files Likely Affected`ncontracts/trustpay-escrow/src/lib.rs`nfrontend/src/components/SubmitMilestoneModal.tsx`n`n✅ Acceptance Criteria`n- Frontend computes SHA-256 hash of deliverable file before upload.`n- Hash is stored in Soroban contract state alongside milestone index.`n`n🧪 Testing Requirements`nVerify computed file hash matches on-chain contract state.`n`nCategory: Smart Contract | Milestone: Milestone 2 – Security | Complexity: Medium (5 pts)";
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Build Multi-Sig Client Wallet Support (SEP-0007 / Freighter Multi-Sig)';
        body = "📌 Summary`nSupport corporate client accounts requiring multi-signature approval from team members.`n`n📖 Background & Problem`nCorporate clients with multi-sig Stellar accounts cannot sign single-key web transactions easily.`nProblem Statement: Platform fails when client address has threshold signers configured.`n`n💡 Proposed Solution`nIntegrate SEP-0007 transaction URI / multi-sig payload collection flow in frontend.`n`n📂 Files Likely Affected`nfrontend/src/lib/stellar.ts`nfrontend/src/hooks/useMultiSig.ts`n`n✅ Acceptance Criteria`n- Detects multi-sig requirements on client address.`n- Supports collecting partial signatures before broadcasting to Stellar ledger.`n`n🧪 Testing Requirements`nTest transaction signing using a 2-of-2 threshold Stellar testnet account.`n`nCategory: Fullstack | Milestone: Milestone 3 – Enterprise Features | Complexity: High (8 pts)";
        labels = 'fullstack,drip-wave,stellar'
    },
    @{
        title = '[FEAT]: Soroban Contract: Emergency Pause and Admin Safety Circuit Breaker';
        body = "📌 Summary`nAdd emergency admin circuit breaker mechanism to pause contract operations.`n`n📖 Background & Problem`nIf an unexpected vulnerability is discovered, there is no way to temporarily halt deposits.`nProblem Statement: Missing emergency pause mechanism in smart contract.`n`n💡 Proposed Solution`nAdd paused flag to contract storage and require_not_paused assertion on state-changing methods.`n`n📂 Files Likely Affected`ncontracts/trustpay-escrow/src/lib.rs`n`n✅ Acceptance Criteria`n- Admin address can invoke set_paused(true).`n- All state-changing methods reject execution while paused.`n`n🧪 Testing Requirements`nTest contract method invocations in paused vs unpaused state in Rust tests.`n`nCategory: Smart Contract | Milestone: Milestone 2 – Security | Complexity: Medium (5 pts)";
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Implement Freelancer Portfolio and Verified Rating System';
        body = "📌 Summary`nBuild on-chain verified rating system where clients leave 1-5 star reviews upon project completion.`n`n📖 Background & Problem`nFreelancers have no verifiable reputation score based on completed escrow contracts.`nProblem Statement: Missing trust and rating metrics for freelancers.`n`n💡 Proposed Solution`nAdd ratings table and post-completion review modal allowing clients to rate finished projects.`n`n📂 Files Likely Affected`nfrontend/src/components/RatingModal.tsx`nbackend/src/controllers/userController.ts`nsupabase/migrations/0012_ratings_table.sql`n`n✅ Acceptance Criteria`n- Ratings can only be submitted for completed projects with approved milestones.`n- Freelancer profile displays average rating and verified project count.`n`n🧪 Testing Requirements`nSubmit review for completed project and verify profile rating update.`n`nCategory: Fullstack | Milestone: Milestone 2 – Reputation | Complexity: Medium (5 pts)";
        labels = 'fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Implement Partial Refund / Contract Cancellation Flow';
        body = "📌 Summary`nAllow client and freelancer to mutually agree on early project termination.`n`n📖 Background & Problem`nIf both parties agree to cancel a project early, they must currently trigger a dispute.`nProblem Statement: No mutual cancellation path without arbiter intervention.`n`n💡 Proposed Solution`nImplement mutual cancellation method in contract returning unapproved milestone funds to client.`n`n📂 Files Likely Affected`ncontracts/trustpay-escrow/src/lib.rs`nfrontend/src/components/CancelProjectModal.tsx`n`n✅ Acceptance Criteria`n- Requires signatures from both Client and Freelancer.`n- Refund transfers remaining locked escrow funds back to client.`n`n🧪 Testing Requirements`nTest mutual cancellation execution in Rust unit tests.`n`nCategory: Smart Contract | Milestone: Milestone 2 – Core Features | Complexity: Medium (5 pts)";
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Add Web3 Wallet Sign-in with Ethereum / Stellar (SIWE / SIWS Standard)';
        body = "📌 Summary`nImplement cryptographic challenge-response login standard (Sign-In With Stellar) for API auth.`n`n📖 Background & Problem`nAPI authentication currently relies on unverified wallet address passing in HTTP headers.`nProblem Statement: Lack of cryptographically secure wallet session authentication.`n`n💡 Proposed Solution`nBuild SIWS challenge nonce endpoint and wallet signature verification middleware issuing JWT.`n`n📂 Files Likely Affected`nfrontend/src/lib/siws.ts`nbackend/src/middleware/authWallet.ts`n`n✅ Acceptance Criteria`n- Frontend requests challenge nonce from backend and prompts wallet signature.`n- Backend verifies signature and issues short-lived JWT cookie.`n`n🧪 Testing Requirements`nAuthenticate with valid wallet signature and verify JWT issuance.`n`nCategory: Fullstack | Milestone: Milestone 1 – Security | Complexity: High (8 pts)";
        labels = 'fullstack,drip-wave,security'
    },
    @{
        title = '[FEAT]: Build Interactive Contract Event Indexer and GraphQL / REST Explorer';
        body = "📌 Summary`nExpose indexed API endpoint allowing external developers to query historical escrow stats.`n`n📖 Background & Problem`nThird-party analytics tools cannot query platform stats without scanning the entire Stellar ledger.`nProblem Statement: Missing indexed API for external ecosystem analytics.`n`n💡 Proposed Solution`nBuild event indexer populating historical analytics table exposed via REST API route.`n`n📂 Files Likely Affected`nbackend/src/controllers/indexerController.ts`nbackend/src/routes/indexer.ts`n`n✅ Acceptance Criteria`n- Supports filtering events by project ID, client address, and milestone state.`n`n🧪 Testing Requirements`nQuery indexer endpoint and verify response schema matches historical database records.`n`nCategory: Fullstack | Milestone: Milestone 3 – Developer Tooling | Complexity: High (8 pts)";
        labels = 'fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Soroban Contract: Optimistic Auto-Approval with Challenge Period';
        body = "📌 Summary`nImplement optimistic milestone approval where work is automatically approved after 7 days.`n`n📖 Background & Problem`nClients sometimes forget to click approve even when satisfied with deliverable.`nProblem Statement: Manual approval step causes unnecessary payout delays.`n`n💡 Proposed Solution`nStore submitted_at timestamp on milestone submission and allow freelancer claim after 7 days without dispute.`n`n📂 Files Likely Affected`ncontracts/trustpay-escrow/src/lib.rs`nfrontend/src/components/MilestoneTracker.tsx`n`n✅ Acceptance Criteria`n- Milestone stores submitted_at ledger timestamp.`n- claim_optimistic_approval releases funds if 7 days elapse without client challenge.`n`n🧪 Testing Requirements`nTest optimistic approval claim before vs after 7-day challenge window in Rust tests.`n`nCategory: Smart Contract | Milestone: Milestone 2 – Core Contract | Complexity: Medium (5 pts)";
        labels = 'smart-contract,fullstack,drip-wave'
    }
)

# 3. Publish all issues safely
Write-Host "[+] Publishing 45 Drip Wave issues to GitHub with structured schema..." -ForegroundColor Green
$count = 1
foreach ($item in $issues) {
    Write-Host "[$count/45] Creating: $($item.title)..." -ForegroundColor Cyan
    gh issue create --title $item.title --body $item.body --label $item.labels
    $count++
}

Write-Host "[+] All 45 Drip Wave issues published successfully to GitHub!" -ForegroundColor Green
