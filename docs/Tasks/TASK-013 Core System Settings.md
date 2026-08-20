---
type: task
status: not-started
phase: 1
module: settings
depends_on:
  - TASK-006
  - TASK-007
  - TASK-012
tags:
  - task
---

# TASK-013 — Core System Settings

Status: NOT STARTED

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Persist core system settings needed by later phases.

## Source Documents

- [[Settings]]
- [[Security]]
- [[Definitions]]

## Dependencies

[[TASK-006 User Management]], [[TASK-007 Company CRUD]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Reporting currency setting (configurable; do not lock [[05 Architecture Decisions#ADR-011 — Reporting/base currency default|ADR-011]]), timezone defaults, rounding tolerance placeholder. Secrets must not live here unencrypted.

### Excluded

Fixed conversion rates. Gateway credentials.

## Database Changes

system_settings.

## Backend

Admin-only settings read/update. Audit setting changes.

## Frontend

Settings system area.

## Authorization

Admin only.

## Business Rules

BR-015 for settings changes.

## Error Handling

Non-Admin 403.

## Tests

### Unit

N/A

### Integration

Settings read/update.

### Authorization

Non-Admin cannot mutate settings.

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

[[TASK-014 Currency Master]]
