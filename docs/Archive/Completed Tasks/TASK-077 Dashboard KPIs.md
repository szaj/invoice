---
type: task
status: complete
phase: 8
module: reporting
depends_on:
  - TASK-060
  - TASK-046
  - TASK-047
tags:
  - task
---

# TASK-077 — Dashboard KPIs

Status: COMPLETE

Phase: 8 ([[Phase 08 Reporting]])

## Objective

KPI cards using definitions from [[Dashboard and Reporting]] 13.1.

## Source Documents

- [[Dashboard and Reporting]]
- [[Screen Inventory]]
- [[Definitions]]

## Dependencies

[[TASK-060 Payment Allocation]], [[TASK-046 Settlement Conversion Snapshot]], [[TASK-047 Merchant Fee Reconciliation Fields]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Total Invoiced, Total Paid, Outstanding, Overdue, Converted Settlement from stored snapshots, optional fees separately, optional actual received, counts. Filters from 13.2 as applicable.

### Excluded

Mixing original currencies into one unlabeled number. Deducting merchant fees from converted settlement.

## Database Changes

Read aggregates; indexes from [[Security]] 20.2.

## Backend

Dashboard API.

## Frontend

Dashboard KPI cards, filters, company switcher.

## Authorization

View dashboard: all roles within scope.

## Business Rules

BR-013. Fees displayed separately.

## Error Handling

N/A

## Tests

### Unit

Fee separation; snapshot-based conversion.

### Integration

Dashboard payload.

### Authorization

Staff scoped.

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

- `src/domain/reporting/types.ts`
- `src/domain/reporting/schema.ts`
- `src/domain/reporting/dashboard-kpis.ts`
- `src/server/reporting/dashboard-repository.ts`
- `src/server/reporting/dashboard-service.ts`
- `src/server/reporting/actions.ts`
- `src/app/api/dashboard/route.ts`
- `src/app/(app)/dashboard-filters.tsx`
- `src/app/(app)/dashboard-kpi-panel.tsx`
- `prisma/migrations/20260827180000_dashboard_kpi_indexes/migration.sql`
- `tests/unit/dashboard-kpis.test.ts`
- `tests/unit/dashboard-ui-authz.test.ts`
- `tests/integration/dashboard-kpis.test.ts`

### Files Modified

- `src/app/(app)/page.tsx` — Dashboard KPIs + filters
- `src/components/layout/nav-config.ts` — Dashboard nav label/`dashboard.view`
- `prisma/schema.prisma` — KPI composite indexes
- Current-state docs (Home, Architecture, Status, Plan, Dev Log, Phase 08, Dashboard module)

### Migrations

- `20260827180000_dashboard_kpi_indexes` — `(companyId, status, dueDate)` / `(companyId, invoiceDate)` on invoices; `(companyId, status, paymentDate)` on payments

### APIs

- `GET /api/dashboard` — KPI payload; `dashboard.view`; company/assignment scope

### Tests

- Unit: fee separation, snapshot settlement, BR-013 buckets, authz/nav
- Integration: dashboard payload + Staff unassigned company denied (RUN_DB_INTEGRATION)

### Issues

- ADR-011 remains OPEN: no invented reporting-currency equivalent rollup for Total Invoiced
- Screen Inventory / Security / Definitions wiki notes not present in this vault checkout

### Commit

Not committed in this session.

## Next Recommended Task

[[TASK-078 Invoice Report]]
