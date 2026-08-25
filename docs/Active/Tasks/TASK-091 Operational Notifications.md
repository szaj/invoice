---
type: task
status: not-started
phase: 9
module: notifications
depends_on:
  - TASK-041
  - TASK-013
  - TASK-073
tags:
  - task
---

# TASK-091 — Operational Notifications

Status: NOT STARTED

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

Emit the internal notifications listed in [[Notifications]] through EmailService (Resend adapter), not SDK calls from modules. Queue via BullMQ when send should not block HTTP.

## Source Documents

- [[Notifications]]
- [[Error Handling]]
- [[Compliance]]
- [[Payments]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-041 Email Delivery]], [[TASK-013 Core System Settings]], [[TASK-073 Compliance Notes and Reason Codes]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Invoice email success/fail; optional internal payment success/fail; overdue to assigned staff/admin configurable; compliance flagged; gateway/webhook failure alert to Admin.

### Excluded

Customer portal notifications. Version 1 out of scope items.

## Database Changes

Notification settings flags if not already in settings.

## Backend

Emit notifications on those events.

## Frontend

No customer-facing notification center.

## Authorization

Gateway failure alerts to Admin.

## Business Rules

No customer portal notifications in Version 1.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Flagged compliance can notify authorized users.

### Authorization

N/A

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

[[TASK-092 Notification Settings]]
