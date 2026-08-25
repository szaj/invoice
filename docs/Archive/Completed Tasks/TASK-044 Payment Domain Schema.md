---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-030
  - TASK-019
  - TASK-020
tags:
  - task
---

# TASK-044 — Payment Domain Schema

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Create the payment record model with independent financial fields.

## Source Documents

- [[Payments]]
- [[Data Model]]
- [[Definitions]]
- [[Business Rules]]

## Dependencies

[[TASK-030 Invoice Domain Schema]], [[TASK-019 Money Calculation Utilities]], [[TASK-020 Settlement Currency Configuration]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Payment fields from [[Payments]] 10.3 including amounts, settlement, snapshot placeholders, optional fee, optional actual received, statuses Pending/Successful/Failed.

### Excluded

Gateway charges. Overwriting confirmed fields. Using fee in balance math.

## Database Changes

payments.

## Backend

Persistence model + invariants on the record.

## Frontend

None required.

## Authorization

Modify confirmed payment: adjustment workflow only (Phase 06). Domain invariants enforce BR-004/005; public payment APIs remain TASK-045+.

## Business Rules

BR-004, BR-005, BR-020.

## Error Handling

N/A

## Tests

### Unit

Fee stored separately from converted amount.

### Integration

payments table + NUMERIC money columns present (light schema check).

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

- `src/domain/payments/{types,schema,invariants}.ts`
- `src/server/payments/payment-repository.ts`
- `prisma/migrations/20260821250000_payment_domain_schema/`
- `tests/unit/payments-schema.test.ts`
- `tests/integration/payments-schema.test.ts`

### Files Modified

- `prisma/schema.prisma` — `Payment` + status/source/rate-source enums; Company/Customer/Invoice/User/FixedConversionRate relations
- `src/domain/audit/types.ts` — `PAYMENT` entity type reserved
- Prerequisite tests that forbade any `Payment` / `payments` table
- Vault: Payments, Data Model, Database, Testing, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

`20260821250000_payment_domain_schema` — `payments` table (Payments §10.3; provider-agnostic method code; Decimal amounts/rates; optional fee/actual received; rate snapshot placeholders). Applied with `pnpm prisma:migrate:deploy`. No charges, webhooks, allocation, adjustments, or credentials.

### APIs

None (schema/domain foundation only).

### Tests

- Unit: company/invoice/customer required; method codes; fee separate from converted settlement; JS number rejected; SUCCESSFUL immutable / no hard-delete; no Stripe-only columns
- Integration: `payments` table + NUMERIC columns
- `pnpm typecheck` / `lint` / `format:check` / `test` (268) / `test:integration` (54 pass / 4 skipped) / `build` pass

### Issues

None for TASK-044. ADR-009 / ADR-010 / ADR-011 remain OPEN. Charging, webhooks, allocation, provider adapters, and payment UI are later Phase 05 tasks. TASK-047 will harden fee/actual-received reconciliation behavior on top of these columns.

### Commit

Uncommitted (await user request).

## Next Recommended Task

[[TASK-045 Payment Service]]
