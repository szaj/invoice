---
type: log
status: approved
tags:
  - architecture
---

# Development Log

Recent implementation notes only. Full chronological history: [[06 Development Log Archive]].

Do not fabricate completed work.

## Log Format

### YYYY-MM-DD — TASK-XXX

Work completed / Files / Database / Tests / Decisions / Problems / Next task

## Entries

### 2026-08-28 — TASK-103

Production deployment (ADR-017): `deploy/production/` compose stack (web, worker, Redis, Caddy TLS), shared `deploy/docker-entrypoint-web.sh`, production `env.example` runbook with least-privilege credential guidance; `src/domain/ops/production-smoke.ts` checklist + smoke helpers; `pnpm check:production-env`, `pnpm test:production-smoke`, `pnpm docker:production:*`; unit + integration tests.

Next: None — Version 1 task list complete.

### 2026-08-28 — TASK-102

Staging/UAT deployment (ADR-017): multi-target `Dockerfile` (Next.js standalone + worker), `deploy/staging/docker-compose.yml` (web, worker, Redis, Caddy), `env.example` runbook, `Deployment` module with environments table; staging smoke helpers + `pnpm test:staging-smoke` (`STAGING_SMOKE_URL`).

Next: [[TASK-103 Production Deployment]]

### 2026-08-28 — TASK-101

Backup and recovery (ADR-024): `pnpm backup:database` / `pnpm restore:database` scripts with pg_dump gzip artifacts, retention pruning, `.last-success.json` marker, production restore guard; R2 versioning health check; Admin `/settings/operations` backup indicators; runbook `docs/Active/Modules/Backup and Recovery.md`; unit + integration restore guard tests.

Next: [[TASK-102 Staging UAT Environment]]

### 2026-08-28 — TASK-100

Monitoring: `@sentry/nextjs` at Next.js instrumentation + worker boundary with credential scrubbing (`beforeSend`); public `GET /api/health`; Admin `/settings/operations` gateway adapter `healthCheck` + webhook failure indicators (24h `payment_events` FAILED); `GET /api/monitoring/operations` under `settings.manage`; gateway failure email alerts reuse TASK-091 `GATEWAY_FAILURE` notifications.

Next: [[TASK-101 Backup and Recovery]]

### 2026-08-28 — TASK-099

Queue hardening: BullMQ + ioredis + `pnpm worker` dedicated process; queues for Stripe/PayPal webhooks, invoice PDF/email, report exports, operational notifications; exponential retries; `background_jobs` metadata for failure visibility; inline fallback when `REDIS_URL` unset; webhook idempotency preserved via `payment_events`.

### 2026-08-28 — TASK-098

Performance hardening: server-side pagination (default 50 / max 100) on invoice, customer, and payment lists with SQL staff visibility; payment list no longer loads all invoices; extra indexes for invoice number, staff, dates, transaction IDs, and report filters; large dumps remain on TASK-090 export jobs; p95 budget 2s checks on list/report endpoints.

Next: [[TASK-099 Queue Hardening]]

### 2026-08-28 — TASK-097

PDF visual QA suite: `tests/pdf-visual/coverage.ts` registry for PDF-VQA-01..05; representative render fixtures (`tests/helpers/pdf-visual-fixtures.ts`) covering logo/no-logo, USD/GBP/EUR/AED totals, terms, A4/Letter; `tests/unit/pdf-visual-suite.test.ts` with layout JSON snapshots, MediaBox/logo structural checks, metadata assertions, internal-notes boundary; `tests/e2e/pdf-visual-qa.spec.ts` documented sign-off; `pnpm test:pdf-visual` script. Raw react-pdf byte checksums intentionally not snapshotted (non-deterministic CreationDate/ID).

Next: [[TASK-098 Performance Hardening]]

### 2026-08-28 — TASK-096

Playwright E2E suite: `tests/e2e/coverage.ts` registry for E2E-01..17; shared fixtures (`fixtures/credentials`, `auth`, `api-client`); Playwright specs for admin setup, invoice/PDF/email, compliance/audit, staff isolation, PayPal disable, currency enablement, webhook route guards, currency report, invoice cancel, monthly-brand matrix; Vitest delegation sign-off for partial payments, manual FX, snapshot lock, dispute/refund/chargeback chains; `pnpm test:e2e` script; manifest/delegated meta-tests always runnable without credentials.

Next: [[TASK-097 PDF Visual QA]]

### 2026-08-28 — TASK-095

Webhook test suite: `tests/unit/webhook-suite.test.ts` (E2E-10 duplicate prevention, unsigned rejection, idempotency, safe retries, out-of-order SUCCESS/FAILED/PENDING, orphan events, webhook route/service boundary checks); shared `tests/helpers/webhook-fixtures.ts`; `tests/integration/webhook-suite.test.ts` (DB retry + out-of-order); `pnpm test:webhooks` script.

Next: [[TASK-096 E2E Test Suite]]

### 2026-08-28 — TASK-094

Financial calculation test suite: `tests/unit/financial-calculation-suite.test.ts` (BR-020–BR-026, conversion snapshot locking, invoice numbering/status logic, Decimal boundary, financial domain source scan, E2E-13 calculation chain); shared `tests/helpers/financial-calculation-fixtures.ts`; `pnpm test:finance` script. All assertions use Prisma Decimal — no JS float compares.

Next: [[TASK-095 Webhook Testing]]

### 2026-08-28 — TASK-093

Authorization test suite: `tests/unit/authorization-suite.test.ts` (role matrix, authenticated≠authorized, 403 denials, Route Handler and Server Action boundary checks); `tests/integration/authorization-suite.test.ts` (Staff/Compliance cross-company denial on company/customer/invoice reads); shared `tests/helpers/authz-fixtures.ts`; `pnpm test:auth` script.

Next: [[TASK-094 Financial Calculation Testing]]

### 2026-08-28 — TASK-092

Notification settings UI: `/settings/notifications` Admin page with toggles for all operational alert flags (invoice email, optional payments, overdue recipients, compliance, gateway); `notificationSettingsUpdateSchema`; `getNotificationSettings` / `updateNotificationSettings` under `settings.manage` with audit; nav item added. Schema/migration from TASK-091 unchanged; customer invoice merge fields untouched.

Next: [[TASK-093 Authorization Testing]]

### 2026-08-28 — TASK-091

Operational notifications: `OperationalNotificationService` via EmailService (ADR-007); inline job dispatcher (ADR-005); notification flags on `system_settings`; events for invoice email sent/failed, optional payment success/fail, invoice overdue, compliance flagged, gateway/webhook failure; recipient rules (Admin, assigned Compliance, assigned staff for overdue). Tests: unit + integration (compliance flagged recipients).

Next: [[TASK-093 Authorization Testing]]

### 2026-08-27 — TASK-090

Report exports: `POST /api/reports/exports` + download routes; `report_exports` metadata table; CSV/XLSX builders for all Phase 08 tabular reports; inline export job dispatcher (ADR-005); StorageService file storage; `ReportExportActions` on report pages; requires `report.export` (Staff denied — US-009); compliance report export also requires `compliance.review`; audit `reports.exported` (BR-015).

Next: [[TASK-091 Operational Notifications]]

### 2026-08-27 — TASK-089

Reporting Group Rollups: `GET /api/reports/reporting-groups` + `/reports/reporting-groups` UI with dashboard KPIs and monthly-matrix summary blocks rolled up by reporting group; one/all groups or single-brand scope; group membership intersects user assignment (Staff cannot roll up unassigned companies); transaction ownership stays on member companies; matrix amounts in configured reporting currency via stored snapshots (BR-013); `report.view` scoping.

Next: [[TASK-090 Report Exports]]

### 2026-08-27 — TASK-088

Monthly Brand / CB-RF Matrix: `GET /api/reports/monthly-brand` + `/reports/monthly-brand` UI with Jan–Dec + G.Total rows, brand columns, Monthly Total, CB/RF, Net G.Total, annual/current-month summaries, and drill-down IDs; payment received / adjustment effective date basis; reporting currency via stored Admin fixed-rate snapshots; open disputes separate (BR-024 / BR-026); `report.view` scoping.

Next: [[TASK-089 Reporting Group Rollups]]

### 2026-08-27 — TASK-087

Compliance Report: `GET /api/reports/compliance` + `/reports/compliance` UI with review counts (approved/flagged/pending), aging of pending/flagged subjects, and notes references; requires `report.view` + `compliance.review` (Staff denied); read-only (no audit manipulation).

Next: [[TASK-088 Monthly Brand Matrix]]

### 2026-08-27 — TASK-086

Currency Report: `GET /api/reports/currencies` + `/reports/currencies` UI with invoice totals by invoice currency and settlement totals by settlement currency; currencies stay labeled (BR-013); fees never deducted from settlement (BR-020); `report.view` scoping; ADR-011 rollup not invented.

Next: [[TASK-087 Compliance Report]]

### 2026-08-27 — TASK-085

Gateway Report: `GET /api/reports/gateways` + `/reports/gateways` UI with transactions, converted settlement, optional fees/actual received, failures, and refunds by gateway × settlement currency; fees never deducted (BR-020); `report.view` scoping; no mixed unlabeled totals (BR-013); ADR-011 rollup not invented.

Next: [[TASK-087 Compliance Report]]

### 2026-08-27 — TASK-084

Staff Performance: `GET /api/reports/staff` + `/reports/staff` UI with invoices created/sent, value invoiced (creator), collections on assigned invoices; commission not calculated; `report.view` scoping (Staff own only); no mixed unlabeled totals (BR-013); ADR-011 rollup not invented.

Next: [[TASK-085 Gateway Report]]

### 2026-08-27 — TASK-083

Company Performance: `GET /api/reports/companies` + `/reports/companies` UI with invoice and settlement KPIs by owning company; reporting group is filter-only (never ownership); `report.view` scoping; reuses dashboard KPI rules (BR-013/020); ADR-011 rollup not invented.

Next: [[TASK-084 Staff Performance]]

### 2026-08-27 — TASK-082

Customer Report: `GET /api/reports/customers` + `/reports/customers` UI with total invoiced/paid/outstanding by customer × invoice currency; pagination/filter/sort; draft/cancelled excluded; `report.view` scoping; company/customer/currency index; no mixed unlabeled totals (BR-013); ADR-011 rollup not invented.

Next: [[TASK-083 Company Performance]]

### 2026-08-27 — TASK-081

Overdue Aging: `GET /api/reports/overdue-aging` + `/reports/overdue-aging` UI with buckets 1–30 / 31–60 / 61–90 / 90+ by invoice currency; BR-018 past-due open balances only (draft never aged); `report.view` scoping; no mixed unlabeled totals; ADR-011 rollup not invented.

Next: [[TASK-082 Customer Report]]

### 2026-08-27 — TASK-080

Outstanding Report: `GET /api/reports/outstanding` + `/reports/outstanding` UI with §13.3 columns (invoice, customer, due date, age, currency, outstanding, company, staff); collectible open balances only; cancelled excluded by default (BR-019); stored outstanding (BR-009); pagination/filter/sort; `report.view` scoping; company/outstanding/due-date index; no mixed unlabeled totals; ADR-011 rollup not invented.

Next: [[TASK-081 Overdue Aging]]

### 2026-08-27 — TASK-079

Payment Report: `GET /api/reports/payments` + `/reports/payments` UI with §13.3 columns (invoice, customer, method, transaction ID, applied amount, stored fixed-rate snapshot, converted settlement, optional fee/actual received, currency, date, status); pagination/filter/sort; `report.view` scoping; method/settlement-date indexes; stored snapshots only (no live FX); fees reconciliation-only; ADR-011 rollup not invented.

Next: [[TASK-080 Outstanding Report]]

### 2026-08-27 — TASK-078

Invoice Report: `GET /api/reports/invoices` + `/reports/invoices` UI with §13.3 columns (number, customer, company, dates, currency, total, paid, balance, status, staff); pagination/filter/sort; `report.view` for Admin (all), Compliance (assigned), Staff (assigned companies + own/assigned invoices); composite status/currency/date indexes; no mixed unlabeled totals; ADR-011 reporting rollup not invented.

Next: [[TASK-079 Payment Report]]

### 2026-08-27 — TASK-077

Dashboard KPIs: `GET /api/dashboard` + `/` UI with §13.1 cards (invoice-currency invoiced/paid/outstanding/overdue; settlement converted totals from stored snapshots; fees and actual received separate); §13.2 filters as applicable; `dashboard.view` for all roles within company/assignment scope; Staff own/assigned only; composite date/status indexes; no mixed unlabeled totals; ADR-011 reporting rollup not invented.

Next: [[TASK-078 Invoice Report]]

### 2026-08-27 — TASK-076

Read-only audit viewer: `GET /api/audit` with filters (company, actor, actor type, entity, action, date); `audit.read` required; Admin all companies (including company-null events); Compliance assigned companies only; Staff denied (US-010, no invented grant); values re-masked on read; no update/delete APIs; UI `/audit` with timezone display from system default timezone.

Next: [[TASK-077 Dashboard KPIs]]

### 2026-08-27 — TASK-075

Compliance CSV export: `GET /api/compliance/export` with the same queue filters; requires `report.export` + `compliance.review`; Staff denied (US-009); audit `compliance.exported`; Export CSV control on `/compliance`. Full reporting module remains Phase 08.

Next: [[TASK-076 Audit Log Viewer]]

### 2026-08-27 — TASK-074

Compliance review UI: `/compliance` queue with filters; `/compliance/{subjectType}/{id}` detail with approve/flag/status update and notes; server actions over existing compliance APIs; nav gated by `compliance.review`; Staff denied and cannot open unassigned company items; review links on invoice/payment/customer detail.

Next: [[TASK-075 Compliance Export]]

### 2026-08-27 — TASK-073

Compliance notes and reason codes: `compliance_reviews` gains notes/reason/resolution_notes/evidence_refs; `POST /api/compliance/status` accepts them on approve/flag; `POST|GET /api/compliance/notes` for notes without status change; audit `compliance.status_updated` (with reason) and `compliance.note_added`; Staff denied. UI remains TASK-074.

Next: [[TASK-074 Compliance Review UI]]

### 2026-08-27 — TASK-072

Compliance review queue: `GET /api/compliance/queue` with filters (company, staff, date, amount, gateway, currency, status) over invoices/payments/customers; composite queue indexes; `compliance.review` required; Compliance scoped to assigned companies (unassigned company filter → 403); Admin may see all. UI remains TASK-074.

Next: [[TASK-073 Compliance Notes and Reason Codes]]

### 2026-08-25 — TASK-071

Compliance status model: shared `compliance_status` on invoices/payments/customers (Not Reviewed / Under Review / Approved / Flagged); `compliance_reviews` skeleton; `POST /api/compliance/status` requires `compliance.review` (Staff 403); status display on detail pages; Staff cannot change via invoice draft/metadata. Notes/reason codes remain TASK-073.

Next: [[TASK-072 Compliance Review Queue]]

### 2026-08-25 — TASK-070

Shared CB/RF calculation engine in `src/domain/money/cbrf.ts`: CB/RF = processed refunds + chargeback debits/losses − won/reversals; Gross Receipts from SUCCESSFUL payments; Net G.Total = Gross Receipts − CB/RF; open disputes and merchant fees excluded (BR-024 / BR-026). Breakdown + reporting totals helpers for later reports. Payment detail shows settlement-currency CB/RF impact. Unit tests cover formula, dispute exclusion, fee exclusion, and Net G.Total.

Next: [[TASK-071 Compliance Status Model]]

### 2026-08-25 — TASK-069

Payment detail Refund/Adjustment view: lifecycle badges beside original SUCCESSFUL (never rewritten); actions for dispute, full/partial refund, chargeback debit/loss, won/reversal, note, soft-cancel; history labels informational dispute vs financial debit/credit; Staff mutation actions hidden (`payment.adjust` still 403 server-side). Consumes TASK-063–068 APIs via server actions.

Next: [[TASK-070 CBRF Calculation Engine]]

### 2026-08-25 — TASK-068

Adjustment history and notes: list linked `payment_adjustments` (including CANCELLED); add informational `NOTE` + `OPEN`; soft-cancel to `CANCELLED` with audit (never delete); cancelled/notes excluded from financial totals/CB/RF; reason/merchant reference settings fields on note API; `GET /api/payments/{id}/adjustments`, `POST .../adjustment-note`, `POST .../adjustments/{adjustmentId}/cancel`; mutations require `payment.adjust` (Staff denied for mutate; list follows payment view). UI completed in TASK-069.

Next: [[TASK-069 Payment Adjustment UI]] (COMPLETE)

### 2026-08-25 — TASK-067

Chargeback won/reversal workflow: linked reversing `payment_adjustments` (`REVERSAL` + `WON`/`REVERSED`); amounts from prior debit/loss (or merchant actual settlement); original SUCCESSFUL payment and debit row immutable (BR-023 / E2E-16); CB/RF net impact restored (BR-024); `POST /api/payments/{id}/chargeback-won` requires `payment.adjust` (Staff denied). No UI (TASK-069).

Next: [[TASK-068 Adjustment History and Notes]]

### 2026-08-25 — TASK-066

Chargeback debit/loss workflow: linked `payment_adjustments` (`CHARGEBACK` + `DEBITED`/`LOST`) with merchant reference/case ID, reason, and effective date; original SUCCESSFUL payment immutable (BR-023); settlement via merchant actual or payment snapshot (BR-025); CB/RF includes debit on effective date (BR-024); `POST /api/payments/{id}/chargeback-debit` requires `payment.adjust` (Staff denied). No UI (TASK-069).

Next: [[TASK-067 Chargeback Won Reversal]]

### 2026-08-25 — TASK-065

Partial refund workflow: linked `payment_adjustments` (`REFUND` + `PROCESSED`) for partial invoice amount; cumulative invoice/settlement cap vs original payment (over-refund rejected); original SUCCESSFUL payment immutable (BR-023); settlement via merchant actual or invoiceAmount × fixed-rate snapshot (BR-025); optional `adapter.refundPayment` when `supportsPartialRefunds`; CB/RF includes processed amount only; `POST /api/payments/{id}/partial-refund` requires `payment.adjust` (Staff denied). No UI (TASK-069).

Next: [[TASK-066 Chargeback Debit Loss]] (COMPLETE)

### 2026-08-25 — Vault Active + Archive restructure

Work completed:

Documentation-only vault restructure: compact current-state notes (`01`–`04`), `docs/Active/**` for remaining work, `docs/Archive/**` for completed tasks and historical specs. `.cursorignore` excludes Archive from normal Cursor context. Task-execution rule updated for Active-first workflow and auto-archive-on-COMPLETE.

Next task:

[[TASK-066 Chargeback Debit Loss]]

### 2026-08-25 — TASK-064

Full refund workflow: `payment_adjustments` (`REFUND` + `PROCESSED`); original SUCCESSFUL payment immutable (BR-023); settlement via merchant actual or original snapshot (BR-025); optional `adapter.refundPayment`; CB/RF includes processed refund; `POST /api/payments/{id}/refund` requires `payment.adjust` (Staff denied). No UI (TASK-069).

Next: [[TASK-065 Partial Refunds]] (COMPLETE)

### 2026-08-25 — TASK-063

Dispute open workflow: `payment_adjustments` (`DISPUTE` OPEN/UNDER_REVIEW); original payment locked; outstanding/CB/RF unchanged (BR-024); Staff denied. No UI (TASK-069).

Next: [[TASK-064 Full Refunds]] (COMPLETE)
