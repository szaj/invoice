---
type: task
status: not-started
phase: 7
module: compliance
depends_on:
  - TASK-071
  - TASK-009
tags:
  - task
---

# TASK-072 — Compliance Review Queue

Status: NOT STARTED

Phase: 7 ([[Phase 07 Compliance and Audit]])

## Objective

Queue for assigned-company compliance work with filters.

## Source Documents

- [[Compliance]]
- [[Screen Inventory]]
- [[Roles and Permissions]]

## Dependencies

[[TASK-071 Compliance Status Model]], [[TASK-009 Tenant Isolation and Company Context]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Filter by company, staff, date, amount, gateway, currency, status. View customer/invoice/payment/email/audit for assigned companies.

### Excluded

Cross-company queue beyond assignments. Admin may see all.

## Database Changes

Queue query indexes as needed.

## Backend

Compliance queues endpoint.

## Frontend

None (UI is TASK-074).

## Authorization

Assigned companies for Compliance; Admin all.

## Business Rules

Tenant isolation.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Queue scoped.

### Authorization

Compliance cannot see unassigned company items.

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

[[TASK-073 Compliance Notes and Reason Codes]]
