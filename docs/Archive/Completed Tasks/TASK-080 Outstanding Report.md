---
type: task
status: complete
phase: 8
module: reporting
depends_on:
  - TASK-034
  - TASK-060
tags:
  - task
---

# TASK-080 — Outstanding Report

Status: COMPLETE

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Open invoice balance report.

## Source Documents

- [[Dashboard and Reporting]]
- [[Definitions]]

## Dependencies

[[TASK-034 Invoice Totals]], [[TASK-060 Payment Allocation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Invoice, customer, due date, age, currency, outstanding, company, staff. Cancelled excluded from collectible outstanding unless policy says otherwise.

### Excluded

Including cancelled as collectible by default.

## Database Changes

Queries. Composite index on `invoices(company_id, outstanding_amount, due_date)`.

## Backend

Outstanding report endpoint: `GET /api/reports/outstanding`.

## Frontend

Outstanding Report: `/reports/outstanding`.

## Authorization

Role-scoped (`report.view`). Admin all companies; Compliance assigned; Staff assigned companies + own/assigned invoices.

## Business Rules

BR-009, BR-019.

## Error Handling

N/A

## Tests

### Unit

Cancelled excluded by default.

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

- `src/domain/reporting/outstanding-report.ts`
- `src/server/reporting/outstanding-report-repository.ts`
- `src/server/reporting/outstanding-report-service.ts`
- `src/app/api/reports/outstanding/route.ts`
- `src/app/(app)/reports/outstanding/page.tsx`
- `src/app/(app)/reports/outstanding/outstanding-report-filters.tsx`
- `tests/unit/outstanding-report.test.ts`
- `prisma/migrations/20260827210000_outstanding_report_indexes/migration.sql`

### Files Modified

- `src/domain/reporting/types.ts`
- `src/domain/reporting/schema.ts`
- `src/server/reporting/actions.ts`
- `src/components/layout/nav-config.ts`
- `prisma/schema.prisma`
- `docs/Active/Modules/Dashboard and Reporting.md`
- `docs/01 Current Architecture.md`
- `docs/03 Current Implementation Status.md`
- `docs/04 Current Plan.md`
- `docs/00 Home.md`
- `docs/06 Development Log.md`
- `docs/Active/Tasks/Phase 08 Reporting.md`

### Migrations

- `20260827210000_outstanding_report_indexes`

### APIs

- `GET /api/reports/outstanding`

### Tests

- `tests/unit/outstanding-report.test.ts` (cancelled exclusion, age, authz)

### Issues

None. ADR-011 reporting-currency rollup not invented.

### Commit

Not committed (per project policy unless requested).

## Next Recommended Task

[[TASK-081 Overdue Aging]]
