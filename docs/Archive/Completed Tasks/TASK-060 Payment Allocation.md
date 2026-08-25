---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-059
  - TASK-034
tags:
  - task
---

# TASK-060 — Payment Allocation

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Recalculate invoice status from confirmed payment applications.

## Source Documents

- [[Payments]]
- [[Invoices]]
- [[Business Rules]]

## Dependencies

[[TASK-059 Partial Payments]], [[TASK-034 Invoice Totals]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Partially Paid when confirmed applied > 0 and < total; Paid when outstanding reaches zero within rounding tolerance.

### Excluded

Storing a user-edited paid total as source of truth.

## Database Changes

No new migration. Persists derived `confirmed_paid_amount`, `outstanding_amount`, and invoice `status` on existing invoice columns after SUCCESSFUL confirm.

## Backend

- Domain: `computeInvoicePaymentAllocation` / `deriveInvoiceStatusFromPayments` (SUCCESSFUL applications only; BR-009; fees excluded BR-020).
- Service: `allocateInvoiceFromConfirmedPayments` after manual `confirmPayment` and gateway webhook SUCCESSFUL confirm.
- Lifecycle transitions: ISSUED/OVERDUE/PARTIALLY_PAID → PARTIALLY_PAID/PAID.
- Audit: `invoices.payment_allocated`.
- DRAFT/CANCELLED unchanged. Overpayment *allow* not invented (US-015 OPEN; BR-010 default reject).

## Frontend

Invoice totals panel / payment panels show server-stored confirmed paid, outstanding, and status after allocation. Manual payment success copy updated.

## Authorization

N/A beyond payment/invoice access (allocation runs inside already-authorized confirm paths; webhook via signature boundary).

## Business Rules

BR-009, BR-010.

## Error Handling

N/A

## Tests

### Unit

Partial then completing payment; over-application rejection; DRAFT/CANCELLED preserved; fee exclusion.

### Integration

Status becomes Partially Paid then Paid (E2E-03/E2E-04 analogue with GBP→USD Admin snapshot).

### Authorization

N/A

### E2E

E2E-03, E2E-04 covered by integration (no dedicated Playwright payment flow yet; shell E2E only).

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

- `src/domain/invoices/allocation.ts`
- `src/server/invoices/invoice-payment-allocation.ts`
- `tests/unit/invoices-allocation.test.ts`

### Files Modified

- `src/domain/invoices/lifecycle.ts`
- `src/domain/audit/types.ts`
- `src/server/invoices/invoice-repository.ts` (`updatePaymentAllocation`)
- `src/server/payments/payment-service.ts`
- `src/server/payments/actions.ts`
- Invoice/payment UI panels and copy
- Unit/integration payment tests; PayPal adapter boundary assertion tightened to SDK/client imports

### Migrations

None.

### APIs

No new routes. Allocation runs inside existing confirm / webhook SUCCESSFUL paths.

### Tests

- Unit: `tests/unit/invoices-allocation.test.ts` + updated payment/lifecycle/webhook tests
- Integration: `tests/integration/payments-partial.test.ts` (E2E-03/04)
- Full unit: 380 passed
- Full integration (`RUN_DB_INTEGRATION=true`): 65 passed / 4 skipped
- typecheck, lint, format:check, production build: pass

### Issues

US-015 overpayment *allow* remains OPEN. ADR-009 / ADR-010 / ADR-011 remain OPEN. Live Playwright E2E for payments not present (integration covers E2E-03/04).

### Commit

Not committed in-session (commit only on request).

## Next Recommended Task

[[TASK-061 Payment List UI]]
