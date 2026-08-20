---
type: task
status: not-started
phase: 3
module: customers
depends_on:
  - TASK-023
  - TASK-008
tags:
  - task
---

# TASK-025 — Customer Company Relationships

Status: NOT STARTED

Phase: 3 ([[Phase 03 Customers]])

## Objective

Link a customer to multiple companies without duplicating the master record, subject to tenant access policies.

## Source Documents

- [[Customers]]
- [[Companies and Brands]]
- [[Data Model]]

## Dependencies

[[TASK-023 Customer CRUD Service]], [[TASK-008 User Company Assignments]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

customer_companies; filter by company or authorized companies.

### Excluded

Sharing a customer across companies the user is not assigned to.

## Database Changes

customer_companies.

## Backend

Company linkage APIs with server-side assignment checks.

## Frontend

Company linkage on customer create/edit.

## Authorization

Users only see/link companies they can access. Admin may link across companies.

## Business Rules

Tenant isolation. Customer master is reusable across authorized companies.

## Error Handling

Unauthorized linkage rejected.

## Tests

### Unit

N/A

### Integration

Link/unlink.

### Authorization

Staff cannot link unauthorized companies.

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

[[TASK-026 Customer Profile]]
