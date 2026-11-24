# Frontend: verifiable completion certificates, WCAG 2.1 AA escrow UX, atomic bulk payouts, and persistent dashboard state

Close #310
Close #309
Close #308
Close #177

> **Target:** `trustpay-escrow/trustpay-escrow` (`main`)
> **Source:** `xsthar/trustpay-escrow` (`main`)
> **Track:** Stellar Soroban Frontend (Next.js 16 / React 19)

## Summary

This PR delivers four frontend features across the escrow dashboard:

1. **#310 — Milestone Completion Certificate Generator.** A print-ready, verifiable credential for approved milestones, exported as vector SVG or PDF, with a scannable QR code that resolves to the settlement transaction on Stellar Expert.
2. **#309 — Accessibility overhaul.** Reusable keyboard focus trapping, polite/assertive ARIA live regions for on-chain transaction stages, visible high-contrast focus rings, and axe-core WCAG 2.1 AA audits for the new escrow modals.
3. **#308 — Bulk Milestone Payout & Batch Execution.** Enterprise clients can multi-select submitted milestones across projects, see payout/fee/remaining-balance totals recalculate live, and release them atomically in **one** signed Stellar transaction with unified progress and a completion receipt.
4. **#177 — Persistent filter & tab selection.** Client and freelancer dashboards now restore tab, search, category, and token filters from `sessionStorage`, reset safely on wallet switch or corrupt data, and purge persisted state on logout.

---

## #310 — Milestone Completion Certificate

### What changed

| File | Purpose |
| --- | --- |
| `frontend/src/lib/receipt-generator.ts` | New `MilestoneCertificateData`, `buildCertificateSvg`, `generateCertificatePdf`, `downloadCertificateSvg`, `downloadCertificatePdf`, `getCertificateVerificationUrl`, `getCertificateFilename`, `escapeXml`. |
| `frontend/src/components/MilestoneCertificateModal.tsx` | Responsive preview modal with SVG/PDF export, share-link copy, focus trap, and Stellar Expert verification link. |
| `frontend/src/components/MilestoneCertificateButton.tsx` | Compact reusable entry point used by dashboards. |
| `frontend/src/app/projects/[id]/page.tsx` | Certificate action on approved milestones. |
| `frontend/src/components/ClientDashboard.tsx` | Certificate action on completed projects. |
| `frontend/src/components/FreelancerDashboard.tsx` | Certificate action on projects with approved milestones. |

### Acceptance criteria

- [x] Generates a vector SVG certificate (1000×700) with ornate double borders, TrustPay watermark, Stellar mark, project/milestone/payout metadata, freelancer address, issue date, and on-chain proof id.
- [x] Embeds a scannable QR code that resolves directly to the Stellar Expert **transaction** URL (`/tx/<hash>`), falling back to the contract URL when no hash is stored.
- [x] One-click **Download SVG** and **Export PDF** (A4 landscape vector PDF with embedded QR matrix) for high-resolution printing.
- [x] Responsive preview modal with one-click **Copy Shareable Link** (`/projects/:id?certificate=:milestoneId`).
- [x] All user-supplied metadata is XML-escaped before inlining, preventing SVG/HTML injection.

### Tests

`frontend/src/lib/receipt-generator.certificate.test.ts` (5 tests) covers SVG structure, QR path generation, XML escaping, explorer URL fallback, and filename slugging.
`frontend/src/components/MilestoneCertificateModal.test.tsx` (4 tests) covers dialog rendering, inline preview, SVG download trigger, PDF export delegation, and clipboard copy.

---

## #309 — Accessible Keyboard Navigation & Screen Reader Compliance

### What changed

| File | Purpose |
| --- | --- |
| `frontend/src/components/A11yLiveAnnouncer.tsx` | Provider + `useA11yAnnouncer()`; renders `aria-live="polite"` and `aria-live="assertive"` regions and re-announces repeated messages. |
| `frontend/src/hooks/useFocusTrap.ts` | Reusable modal focus trap: initial focus, Tab/Shift+Tab wrapping, Escape handling, and focus restoration to the triggering element. |
| `frontend/src/app/layout.tsx` | Wraps the app in `A11yLiveAnnouncer`. |
| `frontend/src/app/globals.css` | High-contrast `:focus-visible` rings for light/dark/OLED themes and a `.sr-only` utility. |
| `frontend/src/components/MilestoneSubmitModal.tsx` | Dialog semantics, focus trap, Escape, and live announcements for every submission stage. |
| `frontend/src/components/WalletConnect.tsx` | Email and xBull modals now use `role="dialog"`, `aria-modal`, labelling, and focus traps. |
| `frontend/src/app/projects/[id]/page.tsx` | Announces escrow transaction stage/message changes (preparing → success/error). |
| New certificate/payout modals | Built with dialog semantics and focus traps from the start. |

### Acceptance criteria

- [x] Modals trap keyboard focus and return focus to the triggering element on close (`useFocusTrap` tests verify Tab wrapping, Shift+Tab wrapping, Escape, and restoration).
- [x] Asynchronous blockchain state changes announce via `aria-live="polite"` (errors use `assertive`) in `MilestoneSubmitModal`, the project detail transaction flow, and the bulk payout manager.
- [x] Visible high-contrast focus indicators are applied globally in both light and dark/OLED modes.
- [x] axe-core WCAG 2.1 AA audits for the certificate modal and bulk payout manager report **zero critical or serious violations**.

### Scope note

Focus trapping was applied to the core escrow modals named in the issue plus every new modal in this PR. Older, unrelated modals (e.g. tax export, accounts-payable export) still rely on the previous Escape-only helper and can adopt `useFocusTrap` incrementally.

### Tests

`frontend/src/hooks/useFocusTrap.test.tsx` (3), `frontend/src/components/A11yLiveAnnouncer.test.tsx` (3), and `frontend/src/__tests__/a11y-modals.test.tsx` (2 axe audits).

---

## #308 — Bulk Milestone Payout Manager

### What changed

| File | Purpose |
| --- | --- |
| `frontend/src/lib/bulk-payout.ts` | `collectBulkPayoutMilestones`, `summarizeBulkPayout`, `calculateBulkPayoutTotals`, `buildApproveMilestoneArgs`, `buildBulkApproveTransaction`, `executeBulkPayout`, stage→progress mapping. |
| `frontend/src/lib/soroban.ts` | New `invokeSorobanBatch` that packs multiple `invokeContractFunction` operations into a single transaction, one simulation/signature/poll. |
| `frontend/src/components/BulkMilestonePayoutManager.tsx` | Multi-select manager modal: search, token filter, Select All/Clear All, live totals, unified progress bar, completion receipt. |
| `frontend/src/components/ClientDashboard.tsx` | “⚡ Bulk Payout” entry point wired to all client projects. |

### Acceptance criteria

- [x] Renders a multi-select checkbox list of submitted milestones across active projects (excludes disputed/completed escrows and unfunded projects without an on-chain id).
- [x] Calculates payout total, per-operation network fee, and remaining wallet balance dynamically as items are toggled; blocks payout when the batch exceeds the balance.
- [x] Generates one consolidated Soroban transaction containing one `approve_milestone(project_id, index, platform)` invocation per selected milestone, with a unified progress bar across preparing/simulating/signing/submitting/polling.
- [x] Shows a summary receipt with count, total settled, transaction hash, and a Stellar Expert link after confirmation.
- [x] Mixed-token batches are rejected explicitly so totals are never summed across assets.

### Tests

`frontend/src/lib/bulk-payout.test.ts` (6 tests) covers milestone collection/filtering, per-token summaries, live totals and fee math, batch transaction construction (`operations.length`, `invokeHostFunction`, per-operation fee × op count), empty-batch rejection, and unique selection keys.
`frontend/src/components/BulkMilestonePayoutManager.test.tsx` (4 tests) covers listing, selection toggling, Select All/Clear All, total/remaining recalculation, batch execution, and receipt rendering.

---

## #177 — Persistent Tab & Filter Selection

### What changed

| File | Purpose |
| --- | --- |
| `frontend/src/hooks/usePersistentTab.ts` | Existing `usePersistentTab`/`usePersistentFilter`; added `clearPersistedDashboardState()` to purge all `trustpay_tab_*` / `trustpay_filter_*` keys. |
| `frontend/src/store/walletStore.ts` | `disconnect()` now clears persisted dashboard state so a new wallet never inherits stale UI context. |
| `frontend/src/components/ClientDashboard.tsx` | Persisted **project search** and **token filter**, restored on back navigation, with a live result count and empty-filter state. |
| `frontend/src/components/FreelancerDashboard.tsx` | Existing persisted tab, search, and category filters remain wired to `usePersistentTab`/`usePersistentFilter`. |

### Acceptance criteria

- [x] Restores the active tab automatically when navigating back from a project detail page (verified by an unmount/remount route-change simulation).
- [x] Preserves applied search queries and token filters in `sessionStorage` (client dashboard search/token and freelancer search/category).
- [x] Clears persisted tab/filter state on logout and resets on wallet address switch.
- [x] Falls back to the default tab when the stored value is missing, invalid, or corrupt, and falls back on malformed filter JSON.

### Tests

`frontend/src/hooks/usePersistentTab.navigation.test.ts` (3 tests) covers route-change restoration, filter restoration, and logout purge. The pre-existing `usePersistentTab.test.ts` (10 tests) continues to pass.

---

## Verification

Commands run from `frontend/`:

```bash
npm install --legacy-peer-deps
npx vitest run \
  src/lib/receipt-generator.certificate.test.ts \
  src/lib/bulk-payout.test.ts \
  src/hooks/useFocusTrap.test.tsx \
  src/hooks/usePersistentTab.navigation.test.ts \
  src/hooks/usePersistentTab.test.ts \
  src/components/A11yLiveAnnouncer.test.tsx \
  src/components/MilestoneCertificateModal.test.tsx \
  src/components/BulkMilestonePayoutManager.test.tsx \
  src/components/MilestoneSubmitModal.test.tsx \
  src/__tests__/a11y-modals.test.tsx \
  src/__tests__/walletStore.test.ts \
  src/__tests__/metadata.test.ts
```

**Result:** 12 files, **76 tests passed** (30 new tests; the axe-core audits report zero critical/serious WCAG 2.1 AA violations).

### Known repository-level limitations

- `npm run typecheck` does **not** pass on the current base branch due to pre-existing missing imports and incomplete store typings (e.g. `TooltipHelper`, `OrgWalletSwitcher`, `authenticateWithSep10`, `hasSubtleCrypto`, `sha256Hex`, missing `addOrgAccount/removeOrgAccount/setActiveOrgAccount`). None of the errors originate from this PR’s new files; the two type errors introduced during development were fixed.
- `npm ci` fails because the committed lockfile is out of sync with `package.json`; `npm install --legacy-peer-deps` is required because of the existing `@types/node@20` vs `vitest@5` optional peer conflict.
- A pre-existing syntax corruption in `frontend/src/app/page.tsx` (`id: <form-feed>aq-,`) was repaired to a template literal (`id: \`faq-${idx}\``) because it blocked the typechecker. It is unrelated to the four issues and is called out here for transparency.
- `axe-core@^4.14.1` was added as a dev dependency for the automated accessibility audits.

## Suggested review order

1. `frontend/src/lib/bulk-payout.ts` + `invokeSorobanBatch` (transaction correctness).
2. `frontend/src/lib/receipt-generator.ts` certificate section (SVG/PDF/QR).
3. `frontend/src/hooks/useFocusTrap.ts` + `A11yLiveAnnouncer.tsx` (a11y primitives).
4. Dashboard integrations (`ClientDashboard`, `FreelancerDashboard`, project detail page).
5. Tests, then the persistence logout purge in `walletStore.ts`.
