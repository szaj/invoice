---
type: task
status: not-started
phase: 7
module: compliance
depends_on:
  - TASK-072
tags:
  - task
---

# TASK-075 — Compliance Export

Status: NOT STARTED

Phase: 7 ([[Phase 07 Compliance and Audit]])

## Objective

Export compliance report if permission is granted.

## Source Documents

- [[Compliance]]
- [[Dashboard and Reporting]]
- [[Audit Logs]]

## Dependencies

[[TASK-072 Compliance Review Queue]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Export with audit of export actions.

### Excluded

Staff export unless later policy grants it (US-009).

## Database Changes

None.

## Backend

Export job/file endpoint.

## Frontend

Export from compliance/report.

## Authorization

Admin yes; Compliance yes; Staff optional — default no until decided.

## Business Rules

Export logged in audit history.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Export audited.

### Authorization

Staff denied by default.

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

[[TASK-076 Audit Log Viewer]]
