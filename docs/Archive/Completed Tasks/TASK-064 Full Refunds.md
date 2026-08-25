---
type: task
status: complete
phase: 6
module: payments
depends_on:
  - TASK-063
tags:
  - task
---

# TASK-064 — Full Refunds

Status: COMPLETE

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Record a processed full refund as a linked adjustment.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Payments]]
- [[Currency and Conversion]]

## Dependencies

[[TASK-063 Dispute Open Workflow]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Refund Processed deducts refund amount; included in CB/RF on refund effective date; original payment preserved; use merchant actual settlement amount if provided else original payment snapshot, not today's rate.

### Excluded

Overwriting original payment. Using the currently active conversion rate merely because the refund is later.

## Database Changes

payment_adjustments type refund.

## Backend

Record/Process Refund; optional adapter.refundPayment if supported.

## Frontend

None required this cycle besides API.

## Authorization

Authorized roles only.

## Business Rules

BR-023, BR-025.

## Error Handling

N/A

## Tests

### Unit

Snapshot-vs-actual amount rule; original preserved.

### Integration

Refund adjustment created.

### Authorization

Staff denied.

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
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/domain/refunds/types.ts`
- `src/domain/refunds/schema.ts`
- `src/domain/refunds/invariants.ts`
- `src/server/refunds/refund-service.ts`
- `src/app/api/payments/[id]/refund/route.ts`
- `tests/unit/payments-refund.test.ts`
- `tests/integration/payments-refund.test.ts`

### Files Modified

- `src/domain/payments/adjustments.ts` — REFUNDED lifecycle
- `src/domain/money/cbrf.ts` — PROCESSED REFUND in CB/RF
- `src/domain/audit/types.ts` — `payments.refund_processed`
- `prisma/schema.prisma` — TASK-064 comment
- `tests/unit/money.test.ts` — refund CB/RF unit coverage
- Vault: TASK-064, Payments, Refunds Disputes Chargebacks, Audit Logs, API, Testing, Error Handling, Data Model, Status, Plan, Phase 06, Home, Development Log

### Migrations

None new. Reuses `payment_adjustments` + `REFUND` type from TASK-063.

### APIs

- `POST /api/payments/{id}/refund` — `payment.adjust`; creates REFUND/PROCESSED linked adjustment; optional provider refund when supported

### Tests

- Unit: snapshot-vs-actual (BR-025); original preserved; Staff 403; duplicate/PENDING rejected; optional adapter.refundPayment; CB/RF includes processed refund
- Integration: refund adjustment created; original payment unchanged (E2E-15 analogue)

### Issues

None.

### Commit

Pending user request.

## Next Recommended Task

[[TASK-065 Partial Refunds]]
