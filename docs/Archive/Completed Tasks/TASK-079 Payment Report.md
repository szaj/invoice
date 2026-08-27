---
type: task
status: complete
phase: 8
module: reporting
depends_on:
  - TASK-046
  - TASK-047
tags:
  - task
---

# TASK-079 — Payment Report

Status: COMPLETE

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Payment report including rate snapshot and converted settlement; optional fee and actual received.

## Source Documents

- [[Dashboard and Reporting]]
- [[Payments]]

## Dependencies

[[TASK-046 Settlement Conversion Snapshot]], [[TASK-047 Merchant Fee Reconciliation Fields]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Minimum output from Payment Report row in 13.3.

### Excluded

Using live rates in the report.

## Database Changes

Queries. Composite indexes on `(company_id, method_code, payment_date)` and `(company_id, settlement_currency_code, payment_date)`.

## Backend

Payment report endpoint: `GET /api/reports/payments`.

## Frontend

Payment Report screen: `/reports/payments`.

## Authorization

Role-scoped (`report.view`). Admin all; Compliance assigned; Staff assigned companies + own/assigned invoices.

## Business Rules

Stored snapshots only.

## Error Handling

N/A

## Tests

### Unit

Uses stored snapshots.

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

- `src/domain/reporting/payment-report.ts`
- `src/server/reporting/payment-report-repository.ts`
- `src/server/reporting/payment-report-service.ts`
- `src/app/api/reports/payments/route.ts`
- `src/app/(app)/reports/payments/page.tsx`
- `src/app/(app)/reports/payments/payment-report-filters.tsx`
- `tests/unit/payment-report.test.ts`
- `prisma/migrations/20260827200000_payment_report_indexes/migration.sql`

### Files Modified

- `src/domain/reporting/types.ts`
- `src/domain/reporting/schema.ts`
- `src/server/reporting/actions.ts`
- `src/components/layout/nav-config.ts`
- `src/app/(app)/page.tsx`
- `prisma/schema.prisma`
- Current-state docs (Home, Architecture, Status, Plan, Dev Log, Dashboard and Reporting, Phase 08)

### Migrations

`20260827200000_payment_report_indexes`

### APIs

`GET /api/reports/payments` — Payment Report (§13.3); `report.view`; stored snapshots only.

### Tests

`tests/unit/payment-report.test.ts` — stored snapshot pass-through; authz/nav/search params.

### Issues

None.

### Commit

Not committed in-task (commit only on request).

## Next Recommended Task

[[TASK-080 Outstanding Report]]
