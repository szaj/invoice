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

# TASK-066 — Chargeback Debit Loss

Status: COMPLETE

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Record chargeback debit/loss as a linked adjustment included in CB/RF.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Dashboard and Reporting]]

## Dependencies

[[TASK-063 Dispute Open Workflow]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Chargeback Debited/Lost; merchant reference/case ID; reason; dates; original payment preserved.

### Excluded

Deleting or reversing the original success row.

## Database Changes

payment_adjustments type chargeback debit/loss (existing `CHARGEBACK` + `DEBITED`/`LOST` enums from TASK-063 schema).

## Backend

Record Chargeback Debit/Loss.

## Frontend

API this cycle.

## Authorization

Authorized roles only.

## Business Rules

BR-024.

## Error Handling

N/A

## Tests

### Unit

CB/RF includes the debit on effective date (with TASK-070).

### Integration

Debit adjustment created.

### Authorization

Staff denied.

### E2E

E2E-16 first half.

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

- `src/domain/chargebacks/types.ts`
- `src/domain/chargebacks/schema.ts`
- `src/domain/chargebacks/invariants.ts`
- `src/server/chargebacks/chargeback-service.ts`
- `src/app/api/payments/[id]/chargeback-debit/route.ts`
- `tests/unit/payments-chargeback-debit.test.ts`
- `tests/integration/payments-chargeback-debit.test.ts`

### Files Modified

- `src/domain/payments/adjustments.ts`
- `src/domain/money/cbrf.ts`
- `src/domain/audit/types.ts`
- `prisma/schema.prisma` (comment only)
- `tests/unit/money.test.ts`
- Active module/status/plan/log docs

### Migrations

None (CHARGEBACK / DEBITED / LOST already present from TASK-063).

### APIs

- `POST /api/payments/{id}/chargeback-debit` — requires `payment.adjust`; creates `CHARGEBACK` + `DEBITED`|`LOST`; audit `payments.chargeback_debited`

### Tests

- Unit: chargeback debit/loss service, CB/RF inclusion, Staff denied
- Integration: debit adjustment created (gated by `RUN_DB_INTEGRATION=true`)

### Issues

None

### Commit

Not committed (awaiting user request)

## Next Recommended Task

[[TASK-067 Chargeback Won Reversal]]
