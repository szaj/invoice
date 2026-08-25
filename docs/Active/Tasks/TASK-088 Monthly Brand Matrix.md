---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-070
  - TASK-011
  - TASK-046
tags:
  - task
---

# TASK-088 — Monthly Brand Matrix

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Spreadsheet-style monthly brand/company matrix based on payment received/effective date by default.

## Source Documents

- [[Dashboard and Reporting]]
- [[Companies and Brands]]

## Dependencies

[[TASK-070 CBRF Calculation Engine]], [[TASK-011 Reporting Groups]], [[TASK-046 Settlement Conversion Snapshot]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Jan–Dec rows; brand columns; Monthly Total; CB/RF; G.Total; annual summary; drill-down to payments/adjustments.

### Excluded

Using invoice creation date as the default basis. Deducting open disputes.

## Database Changes

Queries supporting month/brand aggregation in reporting currency using stored snapshots.

## Backend

Monthly brand report endpoint.

## Frontend

Monthly Brand / CB-RF Report.

## Authorization

Reporting group / company / all-companies filters with authorization.

## Business Rules

BR-024, BR-026.

## Error Handling

N/A

## Tests

### Unit

Month rows, brand columns, dispute exclusion, drill-down IDs.

### Integration

N/A

### Authorization

N/A

### E2E

E2E-17.

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

[[TASK-089 Reporting Group Rollups]]
