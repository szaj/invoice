---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-044
  - TASK-012
tags:
  - task
---

# TASK-045 — Payment Service

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Implement payment domain operations: create pending, confirm, fail, and lock confirmed financial fields.

## Source Documents

- [[Payments]]
- [[Business Rules]]
- [[API and Integrations]]

## Dependencies

[[TASK-044 Payment Domain Schema]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

GET payments; confirm/fail transitions; confirmed financial fields read-only.

### Excluded

Gateway HTTP. UI. Editing confirmed payments.

## Database Changes

None.

## Backend

Payment domain service.

## Frontend

None.

## Authorization

View per role matrix.

## Business Rules

BR-004, BR-005.

## Error Handling

Illegal status transitions rejected.

## Tests

### Unit

Lock after Successful.

### Integration

Create pending / confirm.

### Authorization

Staff cannot modify confirmed fields.

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

- `src/domain/payments/{transitions,access}.ts`
- `src/server/payments/payment-service.ts`
- `src/app/api/payments/route.ts`
- `src/app/api/payments/[id]/route.ts`
- `src/app/api/payments/[id]/confirm/route.ts`
- `src/app/api/payments/[id]/fail/route.ts`
- `tests/unit/payments-service.test.ts`
- `tests/integration/payments-service.test.ts`

### Files Modified

- `src/domain/payments/{types,schema,invariants}.ts` — create-pending input; list query; lock helper; error copy
- `src/server/payments/payment-repository.ts` — filtered list + status-only lifecycle update
- `src/domain/audit/types.ts` — `payments.created` / `confirmed` / `failed`
- Vault: Payments, API, Audit Logs, Testing, Authorization, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

None. Reuses TASK-044 `payments` table.

### APIs

- `GET /api/payments` — company-scoped list (`companyId` required for Admin)
- `GET /api/payments/{id}` — payment detail
- `POST /api/payments` — create PENDING (derives company/customer; resolves Admin fixed rate; computes converted settlement)
- `POST /api/payments/{id}/confirm` — PENDING → SUCCESSFUL (financial fields unchanged)
- `POST /api/payments/{id}/fail` — PENDING → FAILED

No gateway charging, adapters, webhooks, allocation, or payment UI.

### Tests

- Unit: lock after SUCCESSFUL; pending→confirm; fee excluded from settlement; missing Admin rate blocks; Staff denied write; illegal transitions
- Integration: create pending / confirm; Staff cannot record; audit events
- `pnpm typecheck` / `lint` / `format:check` / `test` (277) / `RUN_DB_INTEGRATION=true test:integration` (55 pass / 4 skipped) / `build` pass

### Issues

None for TASK-045. ADR-009 / ADR-010 / ADR-011 remain OPEN. US-015 overpayment deferred to TASK-059/060. Snapshot column `rate_effective_at` remains TASK-046. Allocation/invoice paid status remain TASK-060. Provider adapters remain TASK-048+.

### Commit

Uncommitted (await user request).

## Next Recommended Task

[[TASK-046 Settlement Conversion Snapshot]]
