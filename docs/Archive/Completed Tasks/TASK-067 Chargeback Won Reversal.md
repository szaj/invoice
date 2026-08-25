---
type: task
status: complete
phase: 6
module: payments
depends_on:
  - TASK-066
tags:
  - task
---

# TASK-067 — Chargeback Won Reversal

Status: COMPLETE

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Record chargeback won/reversal as a reversing adjustment that restores net impact.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[02 Current Product Rules]]

## Dependencies

[[TASK-066 Chargeback Debit Loss]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Creates reversing adjustment; reduces CB/RF impact; does not edit original records.

### Excluded

Editing the debit row in place.

## Database Changes

Reversing adjustment row (existing `payment_adjustments` enum: `REVERSAL` + `WON`/`REVERSED`). No new migration.

## Backend

Record Chargeback Won/Reversal.

## Frontend

API this cycle.

## Authorization

Authorized roles only.

## Business Rules

BR-023, BR-024.

## Error Handling

N/A

## Tests

### Unit

Net impact restores without mutating original payment or debit row.

### Integration

Reversal row created.

### Authorization

N/A

### E2E

E2E-16.

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

- `src/app/api/payments/[id]/chargeback-won/route.ts`
- `tests/unit/payments-chargeback-won.test.ts`
- `tests/integration/payments-chargeback-won.test.ts`

### Files Modified

- `src/domain/payments/adjustments.ts` — `isChargebackWonReversal`, lifecycle WON/REVERSED
- `src/domain/chargebacks/types.ts`, `schema.ts`, `invariants.ts`
- `src/domain/money/cbrf.ts` — subtract REVERSAL WON/REVERSED
- `src/domain/audit/types.ts` — `payments.chargeback_won`
- `src/server/chargebacks/chargeback-service.ts` — `recordChargebackWonReversal`
- `prisma/schema.prisma` — comment only
- `tests/unit/money.test.ts`
- Active module docs, implementation status, plan, development log, phase index

### Migrations

None (enums already present from TASK-063).

### APIs

- `POST /api/payments/{id}/chargeback-won` — creates `REVERSAL` + `WON`/`REVERSED`; requires `payment.adjust`

### Tests

- Unit: `payments-chargeback-won.test.ts`, `money.test.ts` CB/RF won/reversal
- Integration: `payments-chargeback-won.test.ts` (E2E-16 net restore)
- Checks run: unit + integration + typecheck + eslint (touched) + prettier + build

### Issues

None.

### Commit

Not committed (per project rules — commit only on request).

## Next Recommended Task

[[TASK-068 Adjustment History and Notes]]
