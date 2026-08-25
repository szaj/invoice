---
type: task
status: complete
phase: 6
module: payments
depends_on:
  - TASK-045
  - TASK-012
tags:
  - task
---

# TASK-063 — Dispute Open Workflow

Status: COMPLETE

Phase: 6 ([[Phase 06 Payment Adjustments]])

## Objective

Mark a confirmed payment as disputed without financial deduction.

## Source Documents

- [[Refunds Disputes Chargebacks]]
- [[Payments]]
- [[Business Rules]]
- [[Audit Logs]]

## Dependencies

[[TASK-045 Payment Service]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Dispute Open/Under Review; original payment immutable; linked payment_adjustment; audit. Open dispute excluded from CB/RF until debit/refund.

### Excluded

Reducing revenue because a dispute was opened. Replacing original success.

## Database Changes

payment_adjustments.

## Backend

Mark as Dispute action.

## Frontend

None (UI is TASK-069).

## Authorization

Admin/Compliance adjustment workflow; Staff no.

## Business Rules

BR-005, BR-023, BR-024.

## Error Handling

N/A

## Tests

### Unit

Dispute open does not change outstanding/CB/RF.

### Integration

Adjustment row created.

### Authorization

Staff denied.

### E2E

E2E-14.

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

- `prisma/migrations/20260825100000_payment_adjustments/migration.sql`
- `src/domain/payments/adjustments.ts` — adjustment types, dispute OPEN/UNDER_REVIEW lifecycle badge
- `src/domain/disputes/types.ts`, `schema.ts`, `invariants.ts`
- `src/domain/money/cbrf.ts` — open-dispute CB/RF exclusion (BR-024); financial inclusion remains TASK-070
- `src/server/payments/payment-adjustment-repository.ts`
- `src/server/disputes/dispute-service.ts` — `openPaymentDispute` (`payment.adjust`)
- `src/app/api/payments/[id]/dispute/route.ts`
- `tests/unit/payments-dispute.test.ts`
- `tests/integration/payments-dispute.test.ts`

### Files Modified

- `prisma/schema.prisma` — `payment_adjustments` + type/status enums
- `src/domain/audit/types.ts` — `payments.dispute_opened`
- `src/domain/money/index.ts`
- `tests/unit/money.test.ts` — dispute exclusion from CB/RF
- `tests/integration/payments-schema.test.ts`
- Vault: TASK-063, Payments, Refunds Disputes Chargebacks, Audit Logs, API, Testing, Error Handling, Status, Plan, Phase 06, Home, Development Log

### Migrations

`20260825100000_payment_adjustments` — `payment_adjustments` table. Original `payments` columns unchanged.

### APIs

`POST /api/payments/{id}/dispute` — Admin/Compliance `payment.adjust`. Creates DISPUTE OPEN/UNDER_REVIEW adjustment. Does not rewrite SUCCESSFUL financial fields. Staff → 403.

### Tests

- Unit: outstanding/CB/RF unchanged; Staff denied; Compliance UNDER_REVIEW; PENDING rejected
- Integration: adjustment row created; original payment + invoice outstanding unchanged (E2E-14 analogue)
- Authorization: Staff denied (`PAYMENT_ADJUST_FORBIDDEN`)

### Issues

None. UI remains TASK-069. Full CB/RF inclusion formula remains TASK-070. No ADR change (ADR-008 already specifies linked adjustments).

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-064 Full Refunds]]
