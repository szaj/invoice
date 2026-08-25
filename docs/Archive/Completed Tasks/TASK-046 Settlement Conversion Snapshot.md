---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-018
  - TASK-045
  - TASK-019
tags:
  - task
---

# TASK-046 — Settlement Conversion Snapshot

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Lock the Admin-defined fixed rate snapshot on confirmed/successful payments.

## Source Documents

- [[Currency and Conversion]]
- [[Payments]]
- [[Business Rules]]

## Dependencies

[[TASK-018 Effective Rate Selection]], [[TASK-045 Payment Service]], [[TASK-019 Money Calculation Utilities]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Store invoice_currency, invoice_amount_applied, settlement_currency, fixed_conversion_rate, rate_source Admin Fixed Rate, rate_effective_at, rate_version_id, converted_settlement_amount. Read-only after Confirmed/Successful.

### Excluded

Recalculating snapshots when Admin later changes rates.

## Database Changes

Snapshot columns on payments.

## Backend

Snapshot on confirm. Corrections via Phase 06 only.

## Frontend

Show snapshot on payment detail later.

## Authorization

Nobody edits locked snapshot fields.

## Business Rules

BR-020, BR-021.

## Error Handling

Missing rate blocks cross-currency confirm. [[Error Handling]]

## Tests

### Unit

Later rate version does not change a confirmed payment.

### Integration

Confirm stores snapshot.

### Authorization

N/A

### E2E

E2E-13.

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

- `src/domain/payments/snapshot.ts`
- `prisma/migrations/20260824260000_payment_settlement_snapshot/migration.sql`
- `tests/unit/payments-snapshot.test.ts`
- `tests/integration/payments-snapshot.test.ts`

### Files Modified

- `prisma/schema.prisma` — `payments.rate_effective_at`
- `src/domain/payments/{types,schema}.ts` — snapshot field + confirmed lock set
- `src/server/payments/{payment-service,payment-repository}.ts` — persist `rateEffectiveAt`; confirm completes snapshot without re-resolving a stored rate
- `tests/unit/payments-{service,schema}.test.ts`, `tests/integration/payments-{service,schema}.test.ts`
- Vault: Currency and Conversion, Payments, Data Model, Database, Testing, Error Handling, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

`20260824260000_payment_settlement_snapshot` — `payments.rate_effective_at TIMESTAMPTZ`. Applied with `pnpm prisma:migrate:deploy`.

### APIs

No new routes. Existing payment create/confirm/GET now include `rateEffectiveAt` on the record. Confirm never rewrites stored rate, converted settlement, or currencies. No payment UI.

### Tests

- Unit: later Admin rate version does not change a stored/confirmed snapshot; same-currency `rateEffectiveAt` = payment date; missing rate blocks cross-currency confirm; fee excluded from converted settlement
- Integration: confirm stores snapshot; E2E-13 analogue (GBP→USD v1 then v2; January payment keeps v1; July payment uses v2). No Playwright (payment UI is later)
- `pnpm typecheck` / `lint` / `format:check` / `test` (284) / `RUN_DB_INTEGRATION=true test:integration` (56 pass / 4 skipped) / `build` pass

### Issues

None for TASK-046. ADR-009 / ADR-010 / ADR-011 remain OPEN. Payment detail UI remains TASK-062. Allocation remains TASK-060. Merchant fee reconciliation fields remain TASK-047.

### Commit

Uncommitted (await user request).

## Next Recommended Task

[[TASK-047 Merchant Fee Reconciliation Fields]]
