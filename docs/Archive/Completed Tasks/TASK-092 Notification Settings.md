---
type: task
status: complete
phase: 9
module: notifications
depends_on:
  - TASK-091
  - TASK-013
tags:
  - task
---

# TASK-092 — Notification Settings

Status: COMPLETE

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

Settings flags (TASK-091 migration; no new migration in TASK-092).

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

Schema validation and Admin authorization for read/update.

### Integration

Toggle persistence.

### Authorization

Non-Admin cannot change notification settings.

### E2E

N/A

## Definition of Done

- [x] Required schema changes completed
- [x] Backend/domain implementation completed
- [x] UI completed where applicable
- [x] Server-side authorization enforced
- [x] Business rules enforced
- [x] Tests added
- [x] Relevant tests passing
- [x] Documentation updated
- [x] [[03 Current Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/domain/notifications/schema.ts`
- `src/server/settings/notification-settings-service.ts`
- `src/app/(app)/settings/notifications/page.tsx`
- `src/app/(app)/settings/notifications/notification-settings-form.tsx`
- `tests/unit/notification-settings.test.ts`
- `tests/integration/notification-settings.test.ts`

### Files Modified

- `src/server/settings/settings-repository.ts` — `updateNotificationSettings`
- `src/server/settings/actions.ts` — load/update server actions
- `src/components/layout/nav-config.ts` — Notifications nav item

### Migrations

None (uses TASK-091 `20260828090000_operational_notification_settings`).

### APIs

Server actions: `loadNotificationSettingsForAdmin`, `updateNotificationSettingsAction` (`settings.manage`).

### Tests

Unit: schema + Admin authz + audit on update. Integration: toggle persistence + Non-Admin denied (DB-gated).

### Issues

None.

### Commit

(not committed)

## Next Recommended Task

[[TASK-093 Authorization Testing]]
