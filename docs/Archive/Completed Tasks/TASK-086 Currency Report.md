---
type: task
status: complete
phase: 8
module: reporting
depends_on:
  - TASK-079
tags:
  - task
---

# TASK-086 — Currency Report

Status: COMPLETE

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Invoice totals by invoice currency and settlement totals by settlement currency.

## Source Documents

- [[Dashboard and Reporting]]
- [[Currency and Conversion]]

## Dependencies

[[TASK-079 Payment Report]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Currency report.

### Excluded

Collapsing currencies without labels.

## Database Changes

Queries.

## Backend

Currency report endpoint.

## Frontend

Currency Report.

## Authorization

Role-scoped.

## Business Rules

BR-013.

## Error Handling

N/A

## Tests

### Unit

Separate currency totals.

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

- `src/domain/reporting/currency-report.ts`
- `src/server/reporting/currency-report-repository.ts`
- `src/server/reporting/currency-report-service.ts`
- `src/app/api/reports/currencies/route.ts`
- `src/app/(app)/reports/currencies/page.tsx`
- `src/app/(app)/reports/currencies/currency-report-filters.tsx`
- `tests/unit/currency-report.test.ts`

### Files Modified

- `src/domain/reporting/types.ts`
- `src/domain/reporting/schema.ts`
- `src/server/reporting/actions.ts`
- `src/components/layout/nav-config.ts`
- `docs/01 Current Architecture.md`
- `docs/03 Current Implementation Status.md`
- `docs/04 Current Plan.md`
- `docs/00 Home.md`
- `docs/06 Development Log.md`
- `docs/Active/Modules/Dashboard and Reporting.md`
- `docs/Active/Tasks/Phase 08 Reporting.md`

### Migrations

None (query-only).

### APIs

- `GET /api/reports/currencies` — Currency Report (`report.view`)

### Tests

- `tests/unit/currency-report.test.ts` — separate currency totals, BR-013/020, authz scoping, nav, search-param parse

### Issues

None. ADR-011 reporting-currency rollup not invented.

### Commit

Not committed in-session (await explicit user request).

## Next Recommended Task

[[TASK-087 Compliance Report]]
