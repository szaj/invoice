---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-044
tags:
  - task
---

# TASK-047 — Merchant Fee Reconciliation Fields

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Capture optional merchant/processor fee and optional actual received amount as reconciliation data only.

## Source Documents

- [[Payments]]
- [[Definitions]]
- [[Dashboard and Reporting]]
- [[Business Rules]]

## Dependencies

[[TASK-044 Payment Domain Schema]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Optional API-provided or manual fee; actual received not auto-derived by subtracting fee from converted settlement.

### Excluded

Using fee to change invoice balance, fixed rate, converted settlement, or invoice amount.

## Database Changes

processor_fee; actual_received_amount.

## Backend

Store only; excluded from conversion and outstanding formulas.

## Frontend

Display separately on payment detail later.

## Authorization

Staff must not smuggle fee into balance.

## Business Rules

BR-020.

## Error Handling

N/A

## Tests

### Unit

Changing fee does not change outstanding or converted settlement.

### Integration

N/A

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
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/domain/payments/reconciliation.ts`
- `tests/unit/payments-reconciliation.test.ts`

### Files Modified

- `src/domain/money/outstanding.ts` — optional fee/actual received ignored in outstanding (BR-020)
- `src/domain/payments/{types,schema}.ts` — balance-guard error; create input is reconciliation-only
- `src/server/payments/{payment-service,payment-repository}.ts` — store provided fee/actual received; never derive; confirm does not rewrite them
- Unit/integration payment tests
- Vault: Payments, Currency and Conversion, Data Model, Testing, Audit Logs, Authorization, Database, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

None. Reuses TASK-044 columns `payments.processor_fee_amount` and `payments.actual_received_amount`. No new Prisma migration.

### APIs

Existing `POST /api/payments` optional `processorFeeAmount` / `actualReceivedAmount` (strict body; client cannot supply converted settlement, outstanding, or invoice total). Confirm/fail still do not accept fee payloads and do not rewrite reconciliation columns.

### Tests

- Unit: fee change does not change outstanding or converted settlement; actual received not derived as settlement − fee; Staff create denied; client cannot smuggle outstanding fields
- Integration: existing create/confirm stores fee separately; actual received remains null when omitted
- `pnpm typecheck` / `lint` / `format:check` / `test` (291) / `RUN_DB_INTEGRATION=true test:integration` (56 pass / 4 skipped) / `build` pass

### Issues

None for TASK-047. ADR-009 / ADR-010 / ADR-011 remain OPEN. Payment detail UI remains TASK-062. Allocation remains TASK-060. Provider adapters remain TASK-048+.

### Commit

Uncommitted (await user request).

## Next Recommended Task

[[TASK-048 Payment Provider Abstraction]]
