---
type: task
status: not-started
phase: 1
module: companies
depends_on:
  - TASK-006
  - TASK-007
tags:
  - task
---

# TASK-008 — User Company Assignments

Status: NOT STARTED

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Constrain access by company assignment. Admin may access all companies; Compliance and Staff are assigned to specific companies.

## Source Documents

- [[Roles and Permissions]]
- [[Companies and Brands]]
- [[Data Model]]
- [[Security]]

## Dependencies

[[TASK-006 User Management]], [[TASK-007 Company CRUD]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

user_companies; Admin assignment UI; server-side checks that Compliance/Staff cannot act outside assigned companies.

### Excluded

Company switcher UI. Treating reporting-group membership as authorization.

## Database Changes

user_companies (user_id, company_id).

## Backend

Persist assignments. Query helpers for assigned company IDs.

## Frontend

Assignment controls on user edit.

## Authorization

Hiding records in the UI is not sufficient. BR-016.

## Business Rules

BR-016. Tenant isolation from [[Companies and Brands]].

## Error Handling

Unassigned company access denied.

## Tests

### Unit

N/A

### Integration

Assignment persistence.

### Authorization

Staff denied unassigned company data.

### E2E

E2E-07 precursor.

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

[[TASK-009 Tenant Isolation and Company Context]]
