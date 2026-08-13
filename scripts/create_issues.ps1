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
        body = '[Summary]' + "`n" + 'Add dynamic visual progress bar and payout calculator widget on Project Details page.' + "`n`n" + '[Background & Problem]' + "`n" + 'Clients and freelancers lack real-time visual feedback on remaining locked escrow funds vs approved payouts.' + "`n" + 'Problem Statement: Hard to track remaining project balance and projected yield at a glance.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build interactive progress bar component calculating approved USDC, locked USDC, and estimated Blend yield.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/app/projects/[id]/page.tsx' + "`n" + 'frontend/src/components/MilestoneTracker.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Progress bar dynamically updates based on milestone states (Pending, Submitted, Approved).' + "`n" + '- Displays total paid USDC, locked USDC, and estimated Blend yield.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Mock milestone states and test rendering across various budget splits.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 1 - Core Features | Complexity: Medium (5 pts)';
        labels = 'frontend,drip-wave,enhancement'
    },
    @{
        title = '[FEAT]: Advanced Filter and Search for Client/Freelancer Dashboards';
        body = '[Summary]' + "`n" + 'Enhance dashboard view with multi-criteria filtering and real-time search.' + "`n`n" + '[Background & Problem]' + "`n" + 'Users with multiple active projects struggle to find specific projects.' + "`n" + 'Problem Statement: No search or status filter on project list views.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Add filter controls for status, date range, client address, and budget threshold with URL query sync.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/ClientDashboard.tsx' + "`n" + 'frontend/src/components/FreelancerDashboard.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Real-time search filter without full page reloads.' + "`n" + '- URL query state sync (e.g. ?status=active&search=website).' + "`n`n" + '[Testing Requirements]' + "`n" + 'Verify filter logic with empty results and multi-select combinations.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 1 - Core Features | Complexity: Low (3 pts)';
        labels = 'frontend,drip-wave,good-first-issue'
    },
    @{
        title = '[FEAT]: Toast Notification System for Stellar Wallet Signature States';
        body = '[Summary]' + "`n" + 'Provide feedback toasts during transaction signing and submission phases.' + "`n`n" + '[Background & Problem]' + "`n" + 'Users are confused while waiting for Freighter wallet signatures or ledger confirmation.' + "`n" + 'Problem Statement: Lack of visual progress feedback during web3 transaction lifecycles.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Implement toast component showing signing, broadcasting, confirmation, and failure states with StellarExpert links.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/hooks/useStellarTx.ts' + "`n" + 'frontend/src/components/Toast.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Displays Stellar transaction hash with direct link to StellarExpert explorer.' + "`n" + '- Auto-dismisses on success after 5 seconds.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Simulate rejected wallet signatures and network timeouts.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 1 - Core Features | Complexity: Medium (5 pts)';
        labels = 'frontend,drip-wave,ux'
    },
    @{
        title = '[FEAT]: Drag-and-Drop File Upload with Image Lightbox Preview';
        body = '[Summary]' + "`n" + 'Create file uploader supporting drag-and-drop attachment with image lightbox preview.' + "`n`n" + '[Background & Problem]' + "`n" + 'Uploading project specifications and proof of work requires clunky file inputs.' + "`n" + 'Problem Statement: No drag-and-drop or full-resolution image preview.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build drag-and-drop upload zone integrated with Supabase storage and a full-screen lightbox modal.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/FileUploadModal.tsx' + "`n" + 'frontend/src/components/ImageLightboxModal.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- File size validation (< 10MB) and file type restriction (PDF, PNG, JPG, ZIP).' + "`n" + '- Lightbox modal allows full-screen preview and direct download.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Test uploading invalid file extensions and large files.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 2 - UI/UX Polish | Complexity: Medium (5 pts)';
        labels = 'frontend,drip-wave,ui'
    },
    @{
        title = '[FEAT]: Global Dark / Light Theme Switcher';
        body = '[Summary]' + "`n" + 'Implement theme toggle matching modern glassmorphism design system.' + "`n`n" + '[Background & Problem]' + "`n" + 'The application currently defaults to dark mode without theme switching capability.' + "`n" + 'Problem Statement: Users cannot toggle light mode according to preference.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Add theme context provider and toggle button storing choice in localStorage.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/ThemeToggle.tsx' + "`n" + 'frontend/src/app/globals.css' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Persists preference in localStorage and respects system prefers-color-scheme.' + "`n" + '- Zero layout shift during theme transition.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Verify toggle state across browser reloads.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 2 - UI/UX Polish | Complexity: Low (2 pts)';
        labels = 'frontend,drip-wave,good-first-issue'
    },
    @{
        title = '[FEAT]: Responsive Mobile Navigation Drawer and Wallet Switcher';
        body = '[Summary]' + "`n" + 'Build smooth sliding mobile navigation drawer with role switcher and wallet disconnect.' + "`n`n" + '[Background & Problem]' + "`n" + 'Navigation controls wrap awkwardly on mobile devices below 480px width.' + "`n" + 'Problem Statement: Poor mobile layout UX for top navbar actions.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Create responsive slide-over drawer containing menu links, active role toggle, and wallet status.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/Navbar.tsx' + "`n" + 'frontend/src/components/MobileDrawer.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Touch-friendly hamburger menu triggers slide-over drawer.' + "`n" + '- Tested across screen widths down to 360px.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Test open/close animations and breakpoint triggers on mobile viewports.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 2 - Mobile Responsiveness | Complexity: Medium (5 pts)';
        labels = 'frontend,drip-wave,mobile'
    },
    @{
        title = '[FEAT]: Form Validation and Auto-Save Drafts for Project Creation';
        body = '[Summary]' + "`n" + 'Add Zod schema validation to project creation forms and auto-save progress.' + "`n`n" + '[Background & Problem]' + "`n" + 'Accidentally refreshing the project creation modal loses all typed milestone details.' + "`n" + 'Problem Statement: No draft persistence or pre-submission input validation.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Validate form inputs with Zod and save form draft state to sessionStorage.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/hooks/useCreateProjectForm.ts' + "`n" + 'frontend/src/components/CreateProjectModal.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Shows clear inline error messages for invalid wallet addresses, negative amounts, or past due dates.' + "`n" + '- Restores draft automatically if page is refreshed.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Submit invalid payloads and verify error messages.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 1 - Core Features | Complexity: Low (3 pts)';
        labels = 'frontend,drip-wave,ux'
    },
    @{
        title = '[FEAT]: Milestone Delivery Verification Modal with Code/Link Submission';
        body = '[Summary]' + "`n" + 'Provide freelancers structured submission modal to attach PR links and demo URLs.' + "`n`n" + '[Background & Problem]' + "`n" + 'Submitting a milestone currently lacks a dedicated interface to attach proof of work.' + "`n" + 'Problem Statement: Freelancers cannot attach pull request links or notes when marking milestone submitted.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build submission modal prompting for deliverable description, PR link, and live demo URL.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/SubmitMilestoneModal.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Validates URL syntax for GitHub PRs and demo links.' + "`n" + '- Triggers Soroban submit_milestone transaction upon form submission.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Verify form submission and contract call trigger.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 1 - Core Features | Complexity: Medium (5 pts)';
        labels = 'frontend,drip-wave'
    },
    @{
        title = '[FEAT]: On-Chain Transaction History Log Component';
        body = '[Summary]' + "`n" + 'Create audit trail component displaying historical contract calls for a project.' + "`n`n" + '[Background & Problem]' + "`n" + 'Users cannot view the complete chronological sequence of contract transactions.' + "`n" + 'Problem Statement: On-chain project events are hidden from the UI.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build transaction history tab fetching and listing contract operations with block explorer links.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/ProjectHistoryTab.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Displays timestamp, calling wallet address, operation type, and Stellar block explorer links.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Verify history rendering for active and completed projects.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 2 - Audit & Analytics | Complexity: Medium (5 pts)';
        labels = 'frontend,drip-wave'
    },
    @{
        title = '[FEAT]: Interactive Proposal Bidding List and Accept/Reject UI';
        body = '[Summary]' + "`n" + 'Create client workspace view to inspect freelancer proposals and trigger single-click acceptance.' + "`n`n" + '[Background & Problem]' + "`n" + 'Clients cannot compare candidate proposals directly inside the project details page.' + "`n" + 'Problem Statement: Missing proposal management dashboard view for clients.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Add proposals tab to project workspace rendering applicant cover notes, portfolio links, and Accept/Deny actions.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/ProposalsList.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Client can accept a proposal, binding freelancer address and updating project status.' + "`n" + '- Provides confirmation modal before denying competing proposals.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Test proposal acceptance and denial state changes.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 1 - Core Features | Complexity: High (8 pts)';
        labels = 'frontend,drip-wave'
    },
    @{
        title = '[FEAT]: Custom Loading Skeleton Screens across All Views';
        body = '[Summary]' + "`n" + 'Replace generic loading spinners with CSS skeleton loaders matching card layouts.' + "`n`n" + '[Background & Problem]' + "`n" + 'Spinner loaders cause abrupt layout shifts when data finishes loading.' + "`n" + 'Problem Statement: Poor perceived performance during initial RPC and database fetches.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Create pulse-animated skeleton loader components mirroring project cards and table rows.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/skeletons/ProjectCardSkeleton.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Pulse animation implemented using pure CSS.' + "`n" + '- Applied to dashboards, project detail pages, and proposal lists.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Inspect visual transition from loading state to populated data.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 2 - UI/UX Polish | Complexity: Low (2 pts)';
        labels = 'frontend,drip-wave,good-first-issue'
    },
    @{
        title = '[FEAT]: Export Project Report as PDF / JSON';
        body = '[Summary]' + "`n" + 'Add export button to generate downloadable PDF audit receipt containing project summary.' + "`n`n" + '[Background & Problem]' + "`n" + 'Freelancers and clients need official documentation of escrow payouts for tax/accounting.' + "`n" + 'Problem Statement: No downloadable export or receipt functionality.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Integrate PDF generation library to create summary document with milestone payout hashes and timestamps.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/ExportReceiptButton.tsx' + "`n" + 'frontend/src/lib/pdfGenerator.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- PDF includes client address, freelancer address, total amount, milestone breakdown, and timestamp.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Generate PDF report and verify data accuracy against on-chain records.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 3 - Enterprise Features | Complexity: Medium (5 pts)';
        labels = 'frontend,drip-wave'
    },
    @{
        title = '[FEAT]: React Error Boundaries with Fallback Recovery';
        body = '[Summary]' + "`n" + 'Wrap major application routes with React Error Boundaries to prevent full app crashes.' + "`n`n" + '[Background & Problem]' + "`n" + 'Uncaught RPC errors or missing props cause the entire Next.js app to render a blank screen.' + "`n" + 'Problem Statement: Weak runtime error resilience in production.' + "`n`n" + '[Proposed Solution]' + "`n" + "Implement ErrorBoundary component rendering friendly recovery fallback with 'Retry Connection' button." + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/ErrorBoundary.tsx' + "`n" + 'frontend/src/app/layout.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + "- Renders user-friendly error card with 'Retry Connection' button." + "`n" + '- Logs unhandled errors silently to console.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Throw artificial render error and verify fallback UI.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 2 - Reliability | Complexity: Low (3 pts)';
        labels = 'frontend,drip-wave,reliability'
    },
    @{
        title = '[FEAT]: Multi-Currency Display (USDC, XLM, USD Equivalent)';
        body = '[Summary]' + "`n" + 'Display real-time fiat USD conversion estimates next to XLM and USDC amounts.' + "`n`n" + '[Background & Problem]' + "`n" + 'Users struggle to mentally convert XLM/USDC token amounts into fiat USD value.' + "`n" + 'Problem Statement: Prices displayed purely in crypto units without fiat reference.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Create currency converter hook fetching DEX/CoinGecko rates and rendering formatted USD equivalents.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/CurrencyDisplay.tsx' + "`n" + 'frontend/src/hooks/useTokenPrice.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Fetches token price every 60 seconds with fallback caching.' + "`n" + '- Shows formatted fiat values (e.g. $1,250.00 USD).' + "`n`n" + '[Testing Requirements]' + "`n" + 'Test API price fetching and fallback formatting when offline.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 2 - UI/UX Polish | Complexity: Medium (5 pts)';
        labels = 'frontend,drip-wave'
    },
    @{
        title = '[FEAT]: Interactive Onboarding Tour for First-Time Users';
        body = '[Summary]' + "`n" + 'Build step-by-step guided tour highlighting wallet connection and project workflows.' + "`n`n" + '[Background & Problem]' + "`n" + 'New users entering the platform are unsure how escrow deposits and milestone approvals work.' + "`n" + 'Problem Statement: High initial user drop-off due to missing onboarding guidance.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build interactive tooltip tour guiding users through wallet connection, project creation, and dashboard switching.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/OnboardingTour.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Tour triggers only on first visit (tracked via localStorage).' + "`n" + '- User can skip or restart tour anytime from footer.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Verify localStorage flag and tour step transitions.' + "`n`n" + 'Category: Frontend | Milestone: Milestone 2 - UI/UX Polish | Complexity: Medium (5 pts)';
        labels = 'frontend,drip-wave,ux'
    },

    # --- Backend Issues (15) ---
    @{
        title = '[FEAT]: Zod API Payload Validation Middleware across All Routes';
        body = '[Summary]' + "`n" + 'Create strict Zod schema validation middleware for all POST/PUT endpoints.' + "`n`n" + '[Background & Problem]' + "`n" + 'Incoming HTTP request bodies are not rigorously validated before reaching controllers.' + "`n" + 'Problem Statement: Potential payload injection or malformed data reaching database.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Implement generic validation middleware verifying request params, query, and body against Zod schemas.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/middleware/validate.ts' + "`n" + 'backend/src/routes/projects.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Returns HTTP 400 with structured JSON error details on invalid inputs.' + "`n" + '- Rejects extra or unrecognized keys.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Send malformed JSON payloads to API routes and verify HTTP 400 response.' + "`n`n" + 'Category: Backend | Milestone: Milestone 1 - Core API | Complexity: Medium (5 pts)';
        labels = 'backend,drip-wave,security'
    },
    @{
        title = '[FEAT]: Rate Limiting Middleware for Public REST Endpoints';
        body = '[Summary]' + "`n" + 'Add express-rate-limit to prevent spam on public API routes.' + "`n`n" + '[Background & Problem]' + "`n" + 'Public endpoints like proposal submissions can be spammed by automated scripts.' + "`n" + 'Problem Statement: API vulnerable to abuse and denial of service.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Configure express-rate-limit middleware with IP-based window limits.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/middleware/rateLimiter.ts' + "`n" + 'backend/src/server.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Limits requests to 100 requests per 15 minutes per IP address.' + "`n" + '- Returns HTTP 429 Too Many Requests with Retry-After header.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Execute rapid automated requests and verify rate limit response.' + "`n`n" + 'Category: Backend | Milestone: Milestone 1 - Security | Complexity: Low (3 pts)';
        labels = 'backend,drip-wave,security'
    },
    @{
        title = '[FEAT]: Enhance Automated Auto-Release Cron Job with Timelock Retries';
        body = '[Summary]' + "`n" + 'Upgrade auto-release cron service with exponential backoff retries.' + "`n`n" + '[Background & Problem]' + "`n" + 'Temporary Horizon RPC network congestion can cause scheduled auto-releases to fail silently.' + "`n" + 'Problem Statement: Failed cron runs do not retry automatically.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Implement retry mechanism with exponential backoff for Stellar contract simulation and execution.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/services/autoReleaseService.ts' + "`n" + 'backend/src/jobs/autoReleaseCron.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Retries up to 3 times on RPC network timeouts.' + "`n" + '- Logs execution results to Supabase notifications table.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Simulate RPC failures and verify retry attempts.' + "`n`n" + 'Category: Backend | Milestone: Milestone 2 - Automation | Complexity: Medium (5 pts)';
        labels = 'backend,drip-wave,cron'
    },
    @{
        title = '[FEAT]: Supabase Row Level Security (RLS) Policy Audit';
        body = '[Summary]' + "`n" + 'Write SQL migration enforcing strict RLS policies on database tables.' + "`n`n" + '[Background & Problem]' + "`n" + 'Database tables lack explicit row-level access controls for anonymous connections.' + "`n" + 'Problem Statement: Risk of unauthorized data access or modification via Supabase client.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Add SQL migration enabling RLS and enforcing client/freelancer ownership checks.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'supabase/migrations/0010_enforce_rls_policies.sql' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Users can only edit their own profile and proposals.' + "`n" + '- Clients can only update projects they created.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Execute SQL queries as unauthorized role and verify access rejection.' + "`n`n" + 'Category: Backend | Milestone: Milestone 1 - Security | Complexity: High (8 pts)';
        labels = 'backend,drip-wave,security'
    },
    @{
        title = '[FEAT]: Comprehensive Structured Logging with Winston / Pino';
        body = '[Summary]' + "`n" + 'Replace console.log statements with structured JSON logger supporting log levels.' + "`n`n" + '[Background & Problem]' + "`n" + 'Current console logging lacks structured format, making production debugging difficult.' + "`n" + 'Problem Statement: Unstructured logs make searching and error tracking difficult.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Integrate Winston logger with JSON formatting, log levels, and request correlation IDs.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/utils/logger.ts' + "`n" + 'backend/src/middleware/requestLogger.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Outputs structured JSON format with timestamp and route metadata.' + "`n" + '- Excludes sensitive wallet private keys or authorization headers.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Trigger server errors and inspect output log schema.' + "`n`n" + 'Category: Backend | Milestone: Milestone 2 - Observability | Complexity: Medium (5 pts)';
        labels = 'backend,drip-wave,observability'
    },
    @{
        title = '[FEAT]: Webhook Event Listener for Stellar Horizon Ledger Events';
        body = '[Summary]' + "`n" + 'Build background worker service streaming contract event logs from Stellar Horizon RPC.' + "`n`n" + '[Background & Problem]' + "`n" + 'Database state updates currently rely on client-side HTTP calls after transactions.' + "`n" + 'Problem Statement: If client browser closes before API call, database becomes out of sync with chain.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Implement event stream listener capturing Soroban contract events and updating Supabase automatically.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/services/stellarEventListener.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Listens for submit_milestone and approve_milestone contract events.' + "`n" + '- Syncs database state instantly without relying on client HTTP calls.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Trigger testnet contract invocation and verify database sync.' + "`n`n" + 'Category: Backend | Milestone: Milestone 2 - Infrastructure | Complexity: High (8 pts)';
        labels = 'backend,drip-wave,stellar'
    },
    @{
        title = '[FEAT]: Email / Discord Notification Service via Resend / Webhooks';
        body = '[Summary]' + "`n" + 'Add email or Discord webhook alerts when milestone work is submitted or disputed.' + "`n`n" + '[Background & Problem]' + "`n" + 'Clients must manually refresh the dashboard to check if a freelancer submitted work.' + "`n" + 'Problem Statement: Missing real-time off-platform push notifications.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Integrate Resend email API or Discord webhook dispatcher triggered on milestone events.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/services/emailService.ts' + "`n" + 'backend/src/controllers/notificationController.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Sends email alert to client when freelancer submits milestone work.' + "`n" + '- Supports configurable notification settings in user profile.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Trigger notification event and verify email delivery to inbox/webhook.' + "`n`n" + 'Category: Backend | Milestone: Milestone 2 - Notifications | Complexity: Medium (5 pts)';
        labels = 'backend,drip-wave,notifications'
    },
    @{
        title = '[FEAT]: Server Health and RPC Monitoring Endpoint';
        body = '[Summary]' + "`n" + 'Create /health REST endpoint returning status of API, Supabase, and Stellar RPC.' + "`n`n" + '[Background & Problem]' + "`n" + 'DevOps monitoring lacks an endpoint to check backend service health.' + "`n" + 'Problem Statement: Unable to perform automated health checks or uptime monitoring.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build /health route checking DB connectivity and RPC node response latency.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/routes/health.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Returns HTTP 200 OK when all services are responsive.' + "`n" + '- Returns HTTP 500 with breakdown if database or RPC is unreachable.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Call /health endpoint and verify response schema.' + "`n`n" + 'Category: Backend | Milestone: Milestone 1 - Core API | Complexity: Low (2 pts)';
        labels = 'backend,drip-wave,good-first-issue'
    },
    @{
        title = '[FEAT]: Automatic Cleanup Job for Stale Unaccepted Proposals';
        body = '[Summary]' + "`n" + 'Schedule daily background job to archive or delete unaccepted proposals.' + "`n`n" + '[Background & Problem]' + "`n" + 'Cancelled or completed projects leave orphaned proposals in the database.' + "`n" + 'Problem Statement: Database bloat from stale proposal entries.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Create cron job deleting unaccepted proposals for closed projects after 30 days.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/jobs/cleanupProposals.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Deletes orphaned proposal entries older than 30 days for closed projects.' + "`n" + '- Logs cleanup statistics.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Run cleanup job against test database records.' + "`n`n" + 'Category: Backend | Milestone: Milestone 2 - Automation | Complexity: Low (3 pts)';
        labels = 'backend,drip-wave,cron'
    },
    @{
        title = '[FEAT]: Redis In-Memory Caching for Frequently Read Projects';
        body = '[Summary]' + "`n" + 'Add Redis caching layer for /api/projects list endpoints.' + "`n`n" + '[Background & Problem]' + "`n" + 'Repeated fetching of active project lists strains PostgreSQL database.' + "`n" + 'Problem Statement: Slow response times under heavy read traffic.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Implement Redis caching with 60-second TTL and automatic cache invalidation on mutations.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/services/cacheService.ts' + "`n" + 'backend/src/controllers/projectController.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Caches project list responses with 60-second TTL.' + "`n" + '- Invalidates cache automatically upon new project creation or proposal acceptance.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Measure endpoint response latency with cache hit vs miss.' + "`n`n" + 'Category: Backend | Milestone: Milestone 3 - Performance | Complexity: Medium (5 pts)';
        labels = 'backend,drip-wave,performance'
    },
    @{
        title = '[FEAT]: Multi-Token Pricing and Conversion Oracle Endpoint';
        body = '[Summary]' + "`n" + 'Build endpoint fetching XLM/USDC exchange rates from Stellar DEX or CoinGecko.' + "`n`n" + '[Background & Problem]' + "`n" + 'Backend needs reliable exchange rates to calculate fiat equivalents.' + "`n" + 'Problem Statement: Missing centralized token pricing service in backend.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Create pricing service querying DEX liquidity pools or CoinGecko API with fallback cache.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/services/priceOracleService.ts' + "`n" + 'backend/src/routes/prices.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Returns token prices in USD with 5-minute fallback caching.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Verify price response format and fallback cache execution.' + "`n`n" + 'Category: Backend | Milestone: Milestone 2 - Core API | Complexity: Low (3 pts)';
        labels = 'backend,drip-wave'
    },
    @{
        title = '[FEAT]: JWT / Signature Verification Middleware for Sensitive Endpoints';
        body = '[Summary]' + "`n" + 'Create middleware requiring signed wallet challenge headers to authenticate POST requests.' + "`n`n" + '[Background & Problem]' + "`n" + 'REST API endpoints currently rely on unauthenticated wallet parameter passing.' + "`n" + 'Problem Statement: Unauthorized users could forge request payloads for arbitrary wallet addresses.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Implement ed25519 signature verification middleware checking signed challenge nonces.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/middleware/authWallet.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Verifies ed25519 signature against claimed Stellar public key.' + "`n" + '- Rejects expired or replay signatures.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Send valid and invalid wallet signatures and verify access control.' + "`n`n" + 'Category: Backend | Milestone: Milestone 1 - Security | Complexity: High (8 pts)';
        labels = 'backend,drip-wave,security'
    },
    @{
        title = '[FEAT]: Project Analytics and Metrics Aggregation Endpoint';
        body = '[Summary]' + "`n" + 'Add analytics endpoint returning total platform volume, active escrow value, and yield earned.' + "`n`n" + '[Background & Problem]' + "`n" + 'Landing page and admin views need platform-wide aggregate metrics.' + "`n" + 'Problem Statement: No aggregated analytics endpoint available.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build /api/analytics route compiling database stats into single cached JSON payload.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/controllers/analyticsController.ts' + "`n" + 'backend/src/routes/analytics.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Returns aggregated platform metrics in single JSON response.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Call /api/analytics and verify calculated totals against database rows.' + "`n`n" + 'Category: Backend | Milestone: Milestone 2 - Analytics | Complexity: Medium (5 pts)';
        labels = 'backend,drip-wave'
    },
    @{
        title = '[FEAT]: Database Migration Rollback Scripts and Integration Tests';
        body = '[Summary]' + "`n" + 'Create automated test suite for database migrations ensuring clean forward and rollback execution.' + "`n`n" + '[Background & Problem]' + "`n" + 'Database migrations are applied manually without automated rollback validation.' + "`n" + 'Problem Statement: Risk of broken database migrations in production deployments.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build migration test runner executing SQL migrations up and down in isolated test container.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/test/migrations.test.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- All migrations execute without SQL errors.' + "`n" + '- Test runner verifies database schema matches expected state post-migration.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Run migration test suite with npm test.' + "`n`n" + 'Category: Backend | Milestone: Milestone 2 - Testing | Complexity: Medium (5 pts)';
        labels = 'backend,drip-wave,testing'
    },
    @{
        title = '[FEAT]: File Upload Security Scanner and MIME Validation';
        body = '[Summary]' + "`n" + 'Add server-side magic byte inspection and size verification for uploaded project attachments.' + "`n`n" + '[Background & Problem]' + "`n" + 'File uploader relies solely on client-side file extension checking.' + "`n" + 'Problem Statement: Vulnerable to malicious file uploads with spoofed extensions.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Implement file inspector checking binary magic bytes before streaming to storage.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/utils/fileSecurity.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Rejects executable files (.exe, .sh, .bat) regardless of file extension.' + "`n" + '- Limits file uploads to strict white-listed MIME types.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Attempt uploading executable file renamed to .pdf and verify rejection.' + "`n`n" + 'Category: Backend | Milestone: Milestone 2 - Security | Complexity: Medium (5 pts)';
        labels = 'backend,drip-wave,security'
    },

    # --- Fullstack & Smart Contract Issues (15) ---
    @{
        title = '[FEAT]: Soroban Contract: Implement On-Chain Ledger Timestamp Auto-Release';
        body = '[Summary]' + "`n" + 'Add on-chain timelock functionality to Soroban contract allowing freelancers to claim milestone funds.' + "`n`n" + '[Background & Problem]' + "`n" + 'If a client becomes inactive after milestone submission, freelancer funds remain locked indefinitely.' + "`n" + 'Problem Statement: Freelancers risk locked capital if clients fail to review submitted work.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Add timelock_deadline to Milestone struct and implement claim_timelock_release contract function.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'contracts/trustpay-escrow/src/lib.rs' + "`n" + 'frontend/src/lib/stellar.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Adds timelock_deadline to Milestone struct in Rust.' + "`n" + '- Implements claim_timelock_release contract function.' + "`n" + "- Frontend shows 'Claim Timelock' button when deadline passes." + "`n`n" + '[Testing Requirements]' + "`n" + 'Write Soroban test simulating ledger timestamp advancement past deadline.' + "`n`n" + 'Category: Smart Contract | Milestone: Milestone 1 - Core Features | Complexity: High (8 pts)';
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Soroban Contract: Add Multi-Arbiter Threshold Voting for Disputes';
        body = '[Summary]' + "`n" + 'Upgrade dispute resolution logic from single arbiter to 2-of-3 multi-signature consensus.' + "`n`n" + '[Background & Problem]' + "`n" + 'A single arbiter address represents a single point of failure in dispute arbitration.' + "`n" + 'Problem Statement: Risk of arbiter bias or compromise in high-value disputes.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Modify contract state to record arbiter votes and execute payout only when threshold is reached.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'contracts/trustpay-escrow/src/lib.rs' + "`n" + 'frontend/src/components/ArbiterModal.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Contract tracks votes from multiple arbiters before executing dispute payout.' + "`n" + '- Frontend displays voting progress bar for dispute cases.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Test dispute resolution with matching vs conflicting arbiter votes in Rust unit tests.' + "`n`n" + 'Category: Smart Contract | Milestone: Milestone 3 - Governance | Complexity: High (8 pts)';
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Blend Yield Optimization Integration: On-Chain Accrual and Payout';
        body = '[Summary]' + "`n" + 'Wire accrue_yield contract logic with off-chain Blend liquidity pool yield calculations.' + "`n`n" + '[Background & Problem]' + "`n" + 'Yield optimization parameters exist in contract state but require active accrual integration.' + "`n" + 'Problem Statement: Escrowed principal does not dynamically accrue yield from liquidity pools.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build off-chain yield manager service invoking accrue_yield and update frontend yield metrics card.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'contracts/trustpay-escrow/src/lib.rs' + "`n" + 'backend/src/jobs/yieldCron.ts' + "`n" + 'frontend/src/components/YieldCard.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Cron updates accrued yield on active contract instances.' + "`n" + '- On project completion, 70% of yield transfers to client and 30% to platform.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Test yield distribution calculations upon project completion.' + "`n`n" + 'Category: Fullstack | Milestone: Milestone 2 - DeFi Integration | Complexity: High (8 pts)';
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Implement Persistent In-App Project Comments and Activity Thread';
        body = '[Summary]' + "`n" + 'Build real-time messaging and discussion tab inside each project workspace.' + "`n`n" + '[Background & Problem]' + "`n" + 'Clients and freelancers must use third-party messaging platforms to discuss deliverables.' + "`n" + 'Problem Statement: Context switching and lack of project discussion record.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Add comments database table and frontend discussion tab supporting real-time messaging.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/ProjectDiscussionTab.tsx' + "`n" + 'backend/src/controllers/commentController.ts' + "`n" + 'supabase/migrations/0011_comments_table.sql' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Messages persist in Supabase and update in real-time.' + "`n" + '- Wallet addresses are verified before posting messages.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Send test messages and verify real-time update across browser tabs.' + "`n`n" + 'Category: Fullstack | Milestone: Milestone 2 - Workspace | Complexity: Medium (5 pts)';
        labels = 'fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Soroban Contract: Support Native XLM and SAC Token Escrows';
        body = '[Summary]' + "`n" + 'Extend Soroban contract token authorization to support both wrapped native XLM and SAC tokens.' + "`n`n" + '[Background & Problem]' + "`n" + 'Contract initialization currently hardcodes token client transfers for single asset type.' + "`n" + 'Problem Statement: Users cannot select between XLM or custom SAC tokens when creating projects.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Update create_project contract method to handle token authorization for arbitrary SAC assets.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'contracts/trustpay-escrow/src/lib.rs' + "`n" + 'frontend/src/components/CreateProjectModal.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Contract accepts native XLM address or custom SAC asset addresses.' + "`n" + '- Frontend currency dropdown lets client choose asset token upon creation.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Deploy contract on testnet and create project using native XLM and USDC tokens.' + "`n`n" + 'Category: Smart Contract | Milestone: Milestone 1 - Core Contract | Complexity: Medium (5 pts)';
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Contract Transaction Simulation and Gas Fee Estimator';
        body = '[Summary]' + "`n" + 'Add pre-flight simulation before submitting Soroban contract transactions to show gas fee estimates.' + "`n`n" + '[Background & Problem]' + "`n" + 'Users sign transactions without knowing the exact CPU/mem gas fee cost in XLM.' + "`n" + 'Problem Statement: Missing pre-signature transaction cost transparency.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Run RPC transaction simulation prior to wallet signing and display fee breakdown modal.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/lib/stellar.ts' + "`n" + 'frontend/src/components/TxSummaryModal.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Runs RPC simulation on create_project or approve_milestone.' + "`n" + '- Displays fee breakdown in XLM before prompting Freighter signature.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Simulate contract invocation and verify estimated fee matches ledger execution.' + "`n`n" + 'Category: Fullstack | Milestone: Milestone 2 - Web3 UX | Complexity: Medium (5 pts)';
        labels = 'fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Build End-to-End Testnet Demo Seed and Automated Script';
        body = '[Summary]' + "`n" + 'Create automated CLI script generating funded testnet wallets and running full milestone lifecycle.' + "`n`n" + '[Background & Problem]' + "`n" + 'Testing the complete client/freelancer flow manually takes significant time.' + "`n" + 'Problem Statement: Lack of automated end-to-end testnet demonstration script.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Write TypeScript CLI script funding Alice/Bob identities, deploying contract, and executing all methods.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'scripts/demo-e2e.ts' + "`n" + 'package.json' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Runs with single command npm run demo:e2e.' + "`n" + '- Outputs transaction hashes and finalized account balances.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Run npm run demo:e2e against Stellar Testnet and verify clean completion.' + "`n`n" + 'Category: Fullstack | Milestone: Milestone 1 - Developer Tooling | Complexity: Medium (5 pts)';
        labels = 'fullstack,drip-wave,testing'
    },
    @{
        title = '[FEAT]: Add Milestone Proof-of-Work File Hashing On-Chain';
        body = '[Summary]' + "`n" + 'Allow freelancers to submit SHA-256 hash of deliverable files on-chain during submit_milestone.' + "`n`n" + '[Background & Problem]' + "`n" + 'Deliverable files stored off-chain could theoretically be altered post-submission.' + "`n" + 'Problem Statement: Missing immutable cryptographic proof of submitted work.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Compute SHA-256 hash of deliverable files client-side and record hash in Soroban contract state.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'contracts/trustpay-escrow/src/lib.rs' + "`n" + 'frontend/src/components/SubmitMilestoneModal.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Frontend computes SHA-256 hash of deliverable file before upload.' + "`n" + '- Hash is stored in Soroban contract state alongside milestone index.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Verify computed file hash matches on-chain contract state.' + "`n`n" + 'Category: Smart Contract | Milestone: Milestone 2 - Security | Complexity: Medium (5 pts)';
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Build Multi-Sig Client Wallet Support (SEP-0007 / Freighter Multi-Sig)';
        body = '[Summary]' + "`n" + 'Support corporate client accounts requiring multi-signature approval from team members.' + "`n`n" + '[Background & Problem]' + "`n" + 'Corporate clients with multi-sig Stellar accounts cannot sign single-key web transactions easily.' + "`n" + 'Problem Statement: Platform fails when client address has threshold signers configured.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Integrate SEP-0007 transaction URI / multi-sig payload collection flow in frontend.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/lib/stellar.ts' + "`n" + 'frontend/src/hooks/useMultiSig.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Detects multi-sig requirements on client address.' + "`n" + '- Supports collecting partial signatures before broadcasting to Stellar ledger.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Test transaction signing using a 2-of-2 threshold Stellar testnet account.' + "`n`n" + 'Category: Fullstack | Milestone: Milestone 3 - Enterprise Features | Complexity: High (8 pts)';
        labels = 'fullstack,drip-wave,stellar'
    },
    @{
        title = '[FEAT]: Soroban Contract: Emergency Pause and Admin Safety Circuit Breaker';
        body = '[Summary]' + "`n" + 'Add emergency admin circuit breaker mechanism to pause contract operations.' + "`n`n" + '[Background & Problem]' + "`n" + 'If an unexpected vulnerability is discovered, there is no way to temporarily halt deposits.' + "`n" + 'Problem Statement: Missing emergency pause mechanism in smart contract.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Add paused flag to contract storage and require_not_paused assertion on state-changing methods.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'contracts/trustpay-escrow/src/lib.rs' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Admin address can invoke set_paused(true).' + "`n" + '- All state-changing methods reject execution while paused.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Test contract method invocations in paused vs unpaused state in Rust tests.' + "`n`n" + 'Category: Smart Contract | Milestone: Milestone 2 - Security | Complexity: Medium (5 pts)';
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Implement Freelancer Portfolio and Verified Rating System';
        body = '[Summary]' + "`n" + 'Build on-chain verified rating system where clients leave 1-5 star reviews upon project completion.' + "`n`n" + '[Background & Problem]' + "`n" + 'Freelancers have no verifiable reputation score based on completed escrow contracts.' + "`n" + 'Problem Statement: Missing trust and rating metrics for freelancers.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Add ratings table and post-completion review modal allowing clients to rate finished projects.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/components/RatingModal.tsx' + "`n" + 'backend/src/controllers/userController.ts' + "`n" + 'supabase/migrations/0012_ratings_table.sql' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Ratings can only be submitted for completed projects with approved milestones.' + "`n" + '- Freelancer profile displays average rating and verified project count.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Submit review for completed project and verify profile rating update.' + "`n`n" + 'Category: Fullstack | Milestone: Milestone 2 - Reputation | Complexity: Medium (5 pts)';
        labels = 'fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Implement Partial Refund / Contract Cancellation Flow';
        body = '[Summary]' + "`n" + 'Allow client and freelancer to mutually agree on early project termination.' + "`n`n" + '[Background & Problem]' + "`n" + 'If both parties agree to cancel a project early, they must currently trigger a dispute.' + "`n" + 'Problem Statement: No mutual cancellation path without arbiter intervention.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Implement mutual cancellation method in contract returning unapproved milestone funds to client.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'contracts/trustpay-escrow/src/lib.rs' + "`n" + 'frontend/src/components/CancelProjectModal.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Requires signatures from both Client and Freelancer.' + "`n" + '- Refund transfers remaining locked escrow funds back to client.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Test mutual cancellation execution in Rust unit tests.' + "`n`n" + 'Category: Smart Contract | Milestone: Milestone 2 - Core Features | Complexity: Medium (5 pts)';
        labels = 'smart-contract,fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Add Web3 Wallet Sign-in with Ethereum / Stellar (SIWE / SIWS Standard)';
        body = '[Summary]' + "`n" + 'Implement cryptographic challenge-response login standard (Sign-In With Stellar) for API auth.' + "`n`n" + '[Background & Problem]' + "`n" + 'API authentication currently relies on unverified wallet address passing in HTTP headers.' + "`n" + 'Problem Statement: Lack of cryptographically secure wallet session authentication.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build SIWS challenge nonce endpoint and wallet signature verification middleware issuing JWT.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'frontend/src/lib/siws.ts' + "`n" + 'backend/src/middleware/authWallet.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Frontend requests challenge nonce from backend and prompts wallet signature.' + "`n" + '- Backend verifies signature and issues short-lived JWT cookie.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Authenticate with valid wallet signature and verify JWT issuance.' + "`n`n" + 'Category: Fullstack | Milestone: Milestone 1 - Security | Complexity: High (8 pts)';
        labels = 'fullstack,drip-wave,security'
    },
    @{
        title = '[FEAT]: Build Interactive Contract Event Indexer and GraphQL / REST Explorer';
        body = '[Summary]' + "`n" + 'Expose indexed API endpoint allowing external developers to query historical escrow stats.' + "`n`n" + '[Background & Problem]' + "`n" + 'Third-party analytics tools cannot query platform stats without scanning the entire Stellar ledger.' + "`n" + 'Problem Statement: Missing indexed API for external ecosystem analytics.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Build event indexer populating historical analytics table exposed via REST API route.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'backend/src/controllers/indexerController.ts' + "`n" + 'backend/src/routes/indexer.ts' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Supports filtering events by project ID, client address, and milestone state.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Query indexer endpoint and verify response schema matches historical database records.' + "`n`n" + 'Category: Fullstack | Milestone: Milestone 3 - Developer Tooling | Complexity: High (8 pts)';
        labels = 'fullstack,drip-wave'
    },
    @{
        title = '[FEAT]: Soroban Contract: Optimistic Auto-Approval with Challenge Period';
        body = '[Summary]' + "`n" + 'Implement optimistic milestone approval where work is automatically approved after 7 days.' + "`n`n" + '[Background & Problem]' + "`n" + 'Clients sometimes forget to click approve even when satisfied with deliverable.' + "`n" + 'Problem Statement: Manual approval step causes unnecessary payout delays.' + "`n`n" + '[Proposed Solution]' + "`n" + 'Store submitted_at timestamp on milestone submission and allow freelancer claim after 7 days without dispute.' + "`n`n" + '[Files Likely Affected]' + "`n" + 'contracts/trustpay-escrow/src/lib.rs' + "`n" + 'frontend/src/components/MilestoneTracker.tsx' + "`n`n" + '[Acceptance Criteria]' + "`n" + '- Milestone stores submitted_at ledger timestamp.' + "`n" + '- claim_optimistic_approval releases funds if 7 days elapse without client challenge.' + "`n`n" + '[Testing Requirements]' + "`n" + 'Test optimistic approval claim before vs after 7-day challenge window in Rust tests.' + "`n`n" + 'Category: Smart Contract | Milestone: Milestone 2 - Core Contract | Complexity: Medium (5 pts)';
        labels = 'smart-contract,fullstack,drip-wave'
    }
)

# 3. Publish all issues safely
Write-Host "[+] Publishing 45 Drip Wave issues to GitHub..." -ForegroundColor Green
$count = 1
foreach ($item in $issues) {
    Write-Host "[$count/45] Creating: $($item.title)..." -ForegroundColor Cyan
    gh issue create --title $item.title --body $item.body --label $item.labels
    $count++
}

Write-Host "[+] All 45 Drip Wave issues published successfully to GitHub!" -ForegroundColor Green
