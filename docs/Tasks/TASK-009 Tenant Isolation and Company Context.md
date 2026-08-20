---
type: task
status: not-started
phase: 1
module: companies
depends_on:
  - TASK-008
tags:
  - task
---

# TASK-009 — Tenant Isolation and Company Context

Status: NOT STARTED

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Enforce company context on every company-scoped request and provide the header company switcher.

## Source Documents

- [[Companies and Brands]]
- [[Roles and Permissions]]
- [[Security]]
- [[Business Rules]]
- [[Error Handling]]

## Dependencies

[[TASK-008 User Company Assignments]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Switcher; Admin All Companies for consolidated reporting only; transactional actions require one concrete company; context change refreshes company-scoped data; server-side company_id checks.

### Excluded

Allowing transactional writes in All Companies context.

## Database Changes

No new financial tables.

## Backend

Reject invalid company context server-side on every company-scoped request.

## Frontend

Header company switcher on authenticated layout. [[Screen Inventory]]

## Authorization

Frontend hiding is not authorization.

## Business Rules

BR-016.

## Error Handling

Invalid company context rejected. [[Error Handling]]

## Tests

### Unit

Context resolver unit tests.

### Integration

Transactional API without concrete company rejected.

### Authorization

Cross-company IDOR denied.

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

[[TASK-010 Company Branding Configuration]]
