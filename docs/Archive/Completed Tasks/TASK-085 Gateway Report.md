---
type: task
status: complete
phase: 8
module: reporting
depends_on:
  - TASK-079
  - TASK-047
tags:
  - task
---

# TASK-085 — Gateway Report

Status: COMPLETE

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Transactions, converted settlement totals, optional fees, optional actual received, failures, refunds by gateway and settlement currency.

## Source Documents

- [[Dashboard and Reporting]]
- [[Payments]]

## Dependencies

[[TASK-079 Payment Report]], [[TASK-047 Merchant Fee Reconciliation Fields]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Gateway report minimum output.

### Excluded

Deducting fees from converted settlement totals.

## Database Changes

Queries.

## Backend

Gateway report endpoint.

## Frontend

Gateway Report.

## Authorization

Role-scoped.

## Business Rules

Fees separate.

## Error Handling

N/A

## Tests

### Unit

Fee separation.

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

- `src/domain/reporting/gateway-report.ts`
- `src/server/reporting/gateway-report-repository.ts`
- `src/server/reporting/gateway-report-service.ts`
- `src/app/api/reports/gateways/route.ts`
- `src/app/(app)/reports/gateways/page.tsx`
- `src/app/(app)/reports/gateways/gateway-report-filters.tsx`
- `tests/unit/gateway-report.test.ts`

### Files Modified

- `src/domain/reporting/types.ts`
- `src/domain/reporting/schema.ts`
- `src/server/reporting/actions.ts`
- `src/components/layout/nav-config.ts`
- Current-state vault docs (status, plan, architecture, module, phase, home, development log)

### Migrations

None (read-model queries only).

### APIs

- `GET /api/reports/gateways` — Gateway Report (`report.view`); rows by gateway × settlement currency.

### Tests

- `tests/unit/gateway-report.test.ts` — fee separation, aggregation, BR-013, auth/scope, nav, param parsing.

### Issues

None.

### Commit

Not committed (agent stop after TASK).

## Next Recommended Task

[[TASK-086 Currency Report]]
