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
