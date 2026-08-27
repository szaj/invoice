---
type: task
status: complete
phase: 8
module: reporting
depends_on:
  - TASK-036
tags:
  - task
---

# TASK-078 — Invoice Report

Status: COMPLETE

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Invoice report minimum output from section 13.3.

## Source Documents

- [[Dashboard and Reporting]]

## Dependencies

[[TASK-036 Invoice Lifecycle]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Invoice number, customer, company, dates, currency, total, paid, balance, status, staff. Pagination/filter/sort.

### Excluded

Unlabeled mixed-currency grand total.

## Database Changes

Queries/indexes.

## Backend

Parameterized report endpoint.

## Frontend

Invoice Report.

## Authorization

Admin all; Compliance assigned; Staff limited.

## Business Rules

BR-013.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Columns/filters.

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

- `src/server/reporting/invoice-report-repository.ts`
- `src/server/reporting/invoice-report-service.ts`
- `src/app/api/reports/invoices/route.ts`
- `src/app/(app)/reports/invoices/page.tsx`
- `src/app/(app)/reports/invoices/invoice-report-filters.tsx`
- `prisma/migrations/20260827190000_invoice_report_indexes/migration.sql`
- `tests/unit/invoice-report-ui-authz.test.ts`
- `tests/integration/invoice-report.test.ts`

### Files Modified

- `src/domain/reporting/types.ts`
- `src/domain/reporting/schema.ts`
- `src/server/reporting/actions.ts`
- `src/components/layout/nav-config.ts`
- `src/app/(app)/page.tsx`
- `prisma/schema.prisma`
- Current-state docs (Home, Architecture, Status, Plan, Development Log, Phase 08, Dashboard and Reporting module)

### Migrations

- `20260827190000_invoice_report_indexes` — `(company_id, status, invoice_date)` and `(company_id, currency_code, invoice_date)`

### APIs

- `GET /api/reports/invoices` — paginated/filtered/sorted Invoice Report (`report.view`)

### Tests

- Unit authz: `tests/unit/invoice-report-ui-authz.test.ts`
- Integration: `tests/integration/invoice-report.test.ts` (columns/filters/staff scope; `RUN_DB_INTEGRATION=true`)

### Issues

None. ADR-011 remains OPEN (no invented reporting-currency rollup).

### Commit

Not committed in this session.

## Next Recommended Task

[[TASK-079 Payment Report]]
