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
