---
type: task
status: not-started
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

Status: NOT STARTED

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

- [ ] Required schema changes completed
- [ ] Backend/domain implementation completed
- [ ] UI completed where applicable
- [ ] Server-side authorization enforced
- [ ] Business rules enforced
- [ ] Tests added
- [ ] Relevant tests passing
- [ ] Documentation updated
- [ ] [[03 Current Implementation Status]] updated
- [ ] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

### Files Modified

### Migrations

### APIs

### Tests

### Issues

### Commit

## Next Recommended Task

[[TASK-078 Invoice Report]]
