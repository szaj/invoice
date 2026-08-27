---
type: task
status: complete
phase: 8
module: reporting
depends_on:
  - TASK-080
  - TASK-036
tags:
  - task
---

# TASK-081 — Overdue Aging

Status: COMPLETE

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Overdue aging buckets 1-30, 31-60, 61-90, 90+ days.

## Source Documents

- [[Dashboard and Reporting]]
- [[02 Current Product Rules]]

## Dependencies

[[TASK-080 Outstanding Report]], [[TASK-036 Invoice Lifecycle]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Outstanding where due date is past and invoice is not paid/cancelled.

### Excluded

Marking draft invoices overdue.

## Database Changes

Queries.

## Backend

Aging report endpoint.

## Frontend

Overdue Aging report.

## Authorization

Role-scoped.

## Business Rules

BR-018.

## Error Handling

N/A

## Tests

### Unit

Bucket tests.

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
- [x] [[03 Current Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/domain/reporting/overdue-aging.ts`
- `src/server/reporting/overdue-aging-repository.ts`
- `src/server/reporting/overdue-aging-service.ts`
- `src/app/api/reports/overdue-aging/route.ts`
- `src/app/(app)/reports/overdue-aging/page.tsx`
- `src/app/(app)/reports/overdue-aging/overdue-aging-filters.tsx`
- `tests/unit/overdue-aging.test.ts`

### Files Modified

- `src/domain/reporting/types.ts`
- `src/domain/reporting/schema.ts`
- `src/server/reporting/actions.ts`
- `src/components/layout/nav-config.ts`
- `docs/00 Home.md`, `docs/01 Current Architecture.md`, `docs/03 Current Implementation Status.md`, `docs/04 Current Plan.md`, `docs/06 Development Log.md`
- `docs/Active/Modules/Dashboard and Reporting.md`
- `docs/Active/Tasks/Phase 08 Reporting.md`

### Migrations

None (query-only; reuses outstanding open-balance indexes).

### APIs

- `GET /api/reports/overdue-aging` — buckets 1–30 / 31–60 / 61–90 / 90+ by invoice currency (`report.view`)

### Tests

- `tests/unit/overdue-aging.test.ts` — bucket boundaries, BR-018 eligibility, authz/nav scoping

### Issues

None.

### Commit

Not committed by agent (awaiting explicit request).

## Next Recommended Task

[[TASK-082 Customer Report]]
