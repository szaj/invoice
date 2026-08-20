---
type: task
status: not-started
phase: 9
module: qa
depends_on:
  - TASK-093
tags:
  - task
---

# TASK-096 — E2E Test Suite

Status: NOT STARTED

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

End-to-end coverage for E2E-01 through E2E-17 using **Playwright**.

## Source Documents

- [[Testing]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-093 Authorization Testing]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

All critical scenarios in [[Testing]] 22.2.

### Excluded

Skipping financial immutability scenarios.

## Database Changes

None.

## Backend

E2E harness against staging/UAT or local.

## Frontend

Flows through real screens where practical.

## Authorization

Includes Staff denied unassigned company.

## Business Rules

All listed E2E IDs.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

N/A

### E2E

E2E-01..17 automated or explicitly signed off with gaps recorded.

## Definition of Done

- [ ] Required schema changes completed
- [ ] Backend/domain implementation completed
- [ ] UI completed where applicable
- [ ] Server-side authorization enforced
- [ ] Business rules enforced
- [ ] Tests added
- [ ] Relevant tests passing
- [ ] Documentation updated
- [ ] [[04 Implementation Status]] updated
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

[[TASK-097 PDF Visual QA]]
