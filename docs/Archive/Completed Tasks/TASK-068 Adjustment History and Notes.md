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

# TASK-068 — Adjustment History and Notes

Status: COMPLETE

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Show linked adjustment history and allow adjustment notes.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Audit Logs]]
- [[Settings]]

## Dependencies

[[TASK-063 Dispute Open Workflow]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

History including Adjustment Cancelled retained for audit and excluded from financial totals. Reason codes/settings fields from Refund/Chargeback Settings.

### Excluded

Deleting history. Using cancelled adjustments in CB/RF.

## Database Changes

Existing payment_adjustments; optional attachments metadata if enabled.

## Backend

List adjustments by payment; add note; cancel adjustment with audit.

## Frontend

None required beyond API until TASK-069.

## Authorization

View per payment access; mutations authorized only.

## Business Rules

Original successful payment remains preserved.

## Error Handling

N/A

## Tests

### Unit

Cancelled adjustments excluded from totals.

### Integration

List/cancel.

### Authorization

N/A

### E2E

N/A

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

- `prisma/migrations/20260825200000_payment_adjustment_note_type/migration.sql`
- `src/domain/payments/adjustment-history.ts`
- `src/domain/payments/adjustment-note-schema.ts`
- `src/domain/payments/adjustment-invariants.ts`
- `src/server/payments/adjustment-history-service.ts`
- `src/app/api/payments/[id]/adjustments/route.ts`
- `src/app/api/payments/[id]/adjustment-note/route.ts`
- `src/app/api/payments/[id]/adjustments/[adjustmentId]/cancel/route.ts`
- `tests/unit/payments-adjustment-history.test.ts`
- `tests/integration/payments-adjustment-history.test.ts`

### Files Modified

- `prisma/schema.prisma` — `NOTE` on `PaymentAdjustmentType`
- `src/domain/payments/adjustments.ts` — NOTE helpers + financial-totals exclusion
- `src/domain/money/cbrf.ts` — NOTE/CANCELLED contribute 0
- `src/domain/audit/types.ts` — `payments.adjustment_note_added` / `payments.adjustment_cancelled`
- `src/server/payments/payment-adjustment-repository.ts` — get/cancel
- `tests/unit/money.test.ts` — cancelled exclusion cases
- Active modules, status, plan, home, development log, Phase 06 index

### Migrations

- `20260825200000_payment_adjustment_note_type` — adds `NOTE` enum value

### APIs

- `GET /api/payments/{id}/adjustments` — list history (payment view access; includes CANCELLED)
- `POST /api/payments/{id}/adjustment-note` — `NOTE` + `OPEN` (`payment.adjust`)
- `POST /api/payments/{id}/adjustments/{adjustmentId}/cancel` — soft-cancel (`payment.adjust`)

### Tests

- Unit: cancelled/NOTE excluded from totals; list/note/cancel authz and immutability
- Integration: list/note/cancel (requires `RUN_DB_INTEGRATION=true`)

### Issues

- DB integration not executed in this environment (`RUN_DB_INTEGRATION` / `DATABASE_URL` unset)
- Evidence attachment metadata not added (requirements not enabled)

### Commit

Not created (not requested)

## Next Recommended Task

[[TASK-069 Payment Adjustment UI]]
