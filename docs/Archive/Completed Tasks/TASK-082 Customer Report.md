---
type: task
status: complete
phase: 8
module: reporting
depends_on:
  - TASK-029
tags:
  - task
---

# TASK-082 — Customer Report

Status: COMPLETE

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Total invoiced/paid/outstanding by customer and currency.

## Source Documents

- [[Dashboard and Reporting]]
- [[Customers]]

## Dependencies

[[TASK-029 Customer Financial Summary]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Currency-aware grouping.

### Excluded

Single mixed-currency total without conversion label.

## Database Changes

Queries. Composite index `(company_id, customer_id, currency_code)`.

## Backend

Customer report endpoint.

## Frontend

Customer Report.

## Authorization

Role-scoped.

## Business Rules

BR-013.

## Error Handling

N/A

## Tests

### Unit

Grouping by currency.

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

- `src/domain/reporting/customer-report.ts`
- `src/server/reporting/customer-report-repository.ts`
- `src/server/reporting/customer-report-service.ts`
- `src/app/api/reports/customers/route.ts`
- `src/app/(app)/reports/customers/page.tsx`
- `src/app/(app)/reports/customers/customer-report-filters.tsx`
- `tests/unit/customer-report.test.ts`
- `prisma/migrations/20260827220000_customer_report_indexes/migration.sql`

### Files Modified

- `src/domain/reporting/types.ts`
- `src/domain/reporting/schema.ts`
- `src/server/reporting/actions.ts`
- `src/components/layout/nav-config.ts`
- `src/app/(app)/page.tsx`
- `prisma/schema.prisma`
- Active vault docs (status, plan, architecture, module, phase, home, log)

### Migrations

- `20260827220000_customer_report_indexes` — `invoices(company_id, customer_id, currency_code)`

### APIs

- `GET /api/reports/customers` — Customer Report (`report.view`)

### Tests

- `tests/unit/customer-report.test.ts` — currency grouping, BR-013, authz/nav, filter parse

### Issues

None. ADR-011 reporting-currency rollup not invented.

### Commit

Not committed (per project policy unless requested).

## Next Recommended Task

[[TASK-083 Company Performance]]
