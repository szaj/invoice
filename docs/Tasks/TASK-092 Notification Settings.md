---
type: task
status: not-started
phase: 9
module: notifications
depends_on:
  - TASK-091
  - TASK-013
tags:
  - task
---

# TASK-092 — Notification Settings

Status: NOT STARTED

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

Make operational notifications configurable; keep merge fields available to templates.

## Source Documents

- [[Notifications]]
- [[Settings]]
- [[PDF and Email]]

## Dependencies

[[TASK-091 Operational Notifications]], [[TASK-013 Core System Settings]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Configurable overdue and similar flags. Merge fields remain as specified. No customer portal notifications.

### Excluded

Inventing extra customer-facing channels.

## Database Changes

Settings flags.

## Backend

Admin configuration of notification flags.

## Frontend

Settings area for notification toggles.

## Authorization

Admin.

## Business Rules

N/A

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Toggle persistence.

### Authorization

Non-Admin cannot change notification settings.

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

[[TASK-093 Authorization Testing]]
