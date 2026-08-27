---
type: task
status: complete
phase: 7
module: compliance
depends_on:
  - TASK-071
  - TASK-009
tags:
  - task
---

# TASK-072 — Compliance Review Queue

Status: COMPLETE

Phase: 7 ([[Phase 07 Compliance and Audit]])

## Objective

Queue for assigned-company compliance work with filters.

## Source Documents

- [[Compliance]]
- [[Screen Inventory]]
- [[Roles and Permissions]]

## Dependencies

[[TASK-071 Compliance Status Model]], [[TASK-009 Tenant Isolation and Company Context]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Filter by company, staff, date, amount, gateway, currency, status. View customer/invoice/payment/email/audit for assigned companies.

### Excluded

Cross-company queue beyond assignments. Admin may see all.

## Database Changes

Queue query indexes as needed.

## Backend

Compliance queues endpoint.

## Frontend

None (UI is TASK-074).

## Authorization

Assigned companies for Compliance; Admin all.

## Business Rules

Tenant isolation.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Queue scoped.

### Authorization

Compliance cannot see unassigned company items.

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

- `src/app/api/compliance/queue/route.ts`
- `prisma/migrations/20260827160000_compliance_review_queue_indexes/migration.sql`
- `tests/unit/compliance-queue.test.ts`
- `tests/integration/compliance-queue.test.ts`

### Files Modified

- `src/domain/compliance/types.ts`
- `src/domain/compliance/schema.ts`
- `src/server/compliance/compliance-repository.ts`
- `src/server/compliance/compliance-service.ts`
- `prisma/schema.prisma`
- `tests/unit/compliance-status.test.ts`
- `docs/01 Current Architecture.md`
- `docs/03 Current Implementation Status.md`
- `docs/04 Current Plan.md`
- `docs/06 Development Log.md`
- `docs/Active/Modules/Compliance.md`
- `docs/Active/Tasks/Phase 07 Compliance and Audit.md`

### Migrations

- `20260827160000_compliance_review_queue_indexes` — composite indexes on invoices/payments for queue filters.

### APIs

- `GET /api/compliance/queue` — filters: companyId, staffUserId, dateFrom, dateTo, amountMin, amountMax, gateway, currency, status, subjectType. Requires `compliance.review`. Returns unified invoice/payment/customer items. Compliance assigned companies only; Admin all.

### Tests

- Unit: Staff 403; Compliance scoped; unassigned company 403; Admin ALL; invalid money filter; empty assignments.
- Integration: queue scoped to assigned company; unassigned filter denied; Admin sees both; payment gateway/amount filters.

### Issues

None.

### Commit

Not committed (no commit requested).

## Next Recommended Task

[[TASK-073 Compliance Notes and Reason Codes]]
