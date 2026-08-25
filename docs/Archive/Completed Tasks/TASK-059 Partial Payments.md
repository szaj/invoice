---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-050
  - TASK-053
tags:
  - task
---

# TASK-059 — Partial Payments

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Allow multiple payment records per invoice, each applying a specific amount in invoice currency.

## Source Documents

- [[Payments]]
- [[Invoices]]
- [[Business Rules]]

## Dependencies

[[TASK-050 Manual Payment Recording]], [[TASK-053 Stripe Webhook]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Multiple successful payments; each has invoice_amount_applied. Do not yet derive invoice Paid/Partial (TASK-060) if split, but records must coexist.

### Excluded

Manually editing paid totals as source of truth.

## Database Changes

Multiple payments per invoice_id (existing schema — no unique constraint; no new migration).

## Backend

Create additional payments against an open invoice. BR-010 open-balance guard on pending create, confirm, and webhook SUCCESSFUL (SUCCESSFUL applications only). Overpayment *allow* not invented (US-015 remains OPEN).

## Frontend

Show multiple payments on invoice view (`InvoicePaymentsPanel`). Manual form shows open balance from SUCCESSFUL applications.

## Authorization

Record permissions as already defined (`payment.manual.record` / `invoice.create` for hosted).

## Business Rules

BR-010: cannot apply more than open balance unless authorized overpayment workflow exists — default reject.

## Error Handling

Over-application rejected by default (`PAYMENT_EXCEEDS_OPEN_BALANCE`).

## Tests

### Unit

Two payments can exist on one invoice; over-application rejected.

### Integration

Second payment against remaining balance; E2E-03 precursor (GBP→USD Admin rate snapshot; fee excluded; no invoice status mutate).

### Authorization

N/A

### E2E

E2E-03 precursor (integration). Full E2E Partially Paid status remains TASK-060.

## Definition of Done

- [x] Required schema changes completed
- [x] Backend/domain implementation completed
- [x] UI completed where applicable
- [x] Server-side authorization enforced
- [x] Business rules enforced
- [x] Tests added
- [x] Relevant tests passing
- [x] Documentation updated
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/app/(app)/payments/invoice-payments-panel.tsx`
- `tests/unit/payments-partial.test.ts`
- `tests/integration/payments-partial.test.ts`

### Files Modified

- `src/domain/payments/manual.ts` — `assertPaymentWithinOpenBalance`
- `src/server/payments/payment-service.ts` — BR-010 on persist/confirm/webhook SUCCESSFUL
- `src/server/payments/actions.ts` — `loadInvoicePaymentsForUi`; open-balance for manual form context
- Invoice view + manual payment UI copy
- Unit payments-service two-partial test

### Migrations

None.

### APIs

No new routes (reuses existing payment create/confirm/list).

### Tests

Unit + integration; full `RUN_DB_INTEGRATION=true test:integration` (65 passed, 4 skipped); typecheck/lint/format/build. E2E N/A beyond precursor.

### Issues

US-015 overpayment *allow* remains OPEN (default reject only). Invoice Paid/Partial + stored paid/outstanding mutation remain TASK-060.

### Commit

Uncommitted (user did not request commit).

## Next Recommended Task

[[TASK-060 Payment Allocation]]
