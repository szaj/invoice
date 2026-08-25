---
type: task
status: complete
phase: 6
module: payments
depends_on:
  - TASK-064
tags:
  - task
---

# TASK-065 — Partial Refunds

Status: COMPLETE

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Record partial refunds with a cumulative cap against the original payment.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[02 Current Product Rules]]

## Dependencies

[[TASK-064 Full Refunds]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Partial Refund Processed; CB/RF for processed amount only. Cumulative deductions must not exceed the original payment unless an authorized correction workflow explicitly allows it.

### Excluded

Silent over-refund.

## Database Changes

Additional adjustment rows.

## Backend

Partial refund endpoint with cumulative cap.

## Frontend

API; UI in TASK-069.

## Authorization

Same as full refund.

## Business Rules

BR-023.

## Error Handling

Over-refund rejected by default.

## Tests

### Unit

Cumulative cap.

### Integration

Partial refund row.

### Authorization

N/A

### E2E

E2E-15.

## Definition of Done

- [x] Required schema changes completed
- [x] Backend/domain implementation completed
- [x] UI completed where applicable
- [x] Server-side authorization enforced
- [x] Business rules enforced
- [x] Tests added
- [x] Relevant tests passing
- [x] Documentation updated
- [x] [[03 Current Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/app/api/payments/[id]/partial-refund/route.ts`
- `tests/integration/payments-partial-refund.test.ts`

### Files Modified

- `src/domain/refunds/types.ts` — `REFUND_EXCEEDS_PAYMENT`, `REFUND_AMOUNT_INVALID`
- `src/domain/refunds/schema.ts` — `partialRefundSchema`
- `src/domain/refunds/invariants.ts` — partial amount resolution + cumulative cap
- `src/server/refunds/refund-service.ts` — `processPartialRefund`
- `src/domain/money/cbrf.ts` — notes for partial refund CB/RF
- `tests/unit/payments-refund.test.ts` — cumulative cap + service tests
- `tests/unit/money.test.ts` — partial CB/RF sum

### Migrations

None new (reuses `payment_adjustments` REFUND/PROCESSED rows from TASK-063/064).

### APIs

- `POST /api/payments/{id}/partial-refund` — requires `payment.adjust`; creates linked REFUND PROCESSED; rejects over-refund

### Tests

- Unit: cumulative cap; partial process; Staff deny; CB/RF partial amounts
- Integration: partial refund row + over-cap reject (E2E-15); `RUN_DB_INTEGRATION=true`

### Issues

None.

### Commit

Not committed (awaiting user request).

## Next Recommended Task

[[TASK-066 Chargeback Debit Loss]]
