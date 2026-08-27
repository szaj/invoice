---
type: task
status: complete
phase: 8
module: reporting
depends_on:
  - TASK-077
tags:
  - task
---

# TASK-083 — Company Performance

Status: COMPLETE

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Invoice and settlement KPIs by company.

## Source Documents

- [[Dashboard and Reporting]]
- [[Companies and Brands]]

## Dependencies

[[TASK-077 Dashboard KPIs]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Company performance report.

### Excluded

Treating reporting group as the owning company.

## Database Changes

Queries. Reuses existing company/date/currency indexes from dashboard and prior reports — no new migration.

## Backend

Company performance endpoint.

## Frontend

Company Performance report.

## Authorization

Admin all; others assigned.

## Business Rules

Ownership remains original company.

## Error Handling

N/A

## Tests

### Unit

Scope + aggregation tests (`tests/unit/company-performance.test.ts`).

### Integration

N/A

### Authorization

Scope tests.

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

- `src/domain/reporting/company-performance.ts`
- `src/server/reporting/company-performance-repository.ts`
- `src/server/reporting/company-performance-service.ts`
- `src/app/api/reports/companies/route.ts`
- `src/app/(app)/reports/companies/page.tsx`
- `src/app/(app)/reports/companies/company-performance-filters.tsx`
- `tests/unit/company-performance.test.ts`

### Files Modified

- `src/domain/reporting/types.ts`
- `src/domain/reporting/schema.ts`
- `src/server/reporting/actions.ts`
- `src/components/layout/nav-config.ts`
- `src/app/(app)/page.tsx`
- `docs/Active/Modules/Dashboard and Reporting.md`
- `docs/01 Current Architecture.md`
- `docs/03 Current Implementation Status.md`
- `docs/04 Current Plan.md`
- `docs/06 Development Log.md`
- `docs/00 Home.md`
- `docs/Active/Tasks/Phase 08 Reporting.md`

### Migrations

None (query-only; existing indexes sufficient).

### APIs

- `GET /api/reports/companies` — Company Performance under `report.view`

### Tests

- `tests/unit/company-performance.test.ts` (aggregation, ownership, BR-013/020, authz scope)

### Issues

None.

### Commit

Not committed (agent does not commit unless asked).

## Next Recommended Task

[[TASK-084 Staff Performance]]
