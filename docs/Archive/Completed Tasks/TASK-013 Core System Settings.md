---
type: task
status: complete
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

Status: COMPLETE

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

- [x] Required schema changes completed
- [x] Backend/domain implementation completed
- [x] UI completed where applicable
- [x] Server-side authorization enforced
- [x] Business rules enforced
- [x] Tests added
- [x] Relevant tests passing
- [x] Documentation updated
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

`src/domain/settings/{types,schema}.ts`, `src/server/settings/{settings-repository,settings-service,actions}.ts`, `src/app/api/system-settings/route.ts`, `src/app/(app)/settings/system/{page,system-settings-form}.tsx`, `prisma/migrations/20260820280000_core_system_settings/`, `tests/unit/system-settings.test.ts`, `tests/integration/system-settings.test.ts`.

### Files Modified

Prisma `SystemSettings` model; `settings.manage` in permissions/matrix; audit action `settings.updated`; home Admin link; authz unit expectations. [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Settings]], [[Roles and Permissions]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-011 consequences note, [[06 Development Log]].

### Migrations

`20260820280000_core_system_settings` — `system_settings` singleton seed (USD / UTC / 0 tolerance recommendation), `settings.manage` permission granted to Admin only. Applied with `pnpm prisma:migrate:deploy`. No currency master, fixed rates, or gateway credentials. ADR-011 remains OPEN (USD seed is configurable, not a locked default).

### APIs

- `GET/PATCH /api/system-settings` — requires `settings.manage` (Admin). Non-Admin → 403.
- UI: `/settings/system`

Updates write `settings.updated` audit events (BR-015). Secrets are not accepted or stored.

### Tests

Unit: schema validation; Admin read/update; Staff/Compliance denied; audit on update. Integration (DB): migration; Admin read/update; Staff mutate denied; audit row; no currencies/rates tables. `pnpm typecheck` / `lint` / `format:check` / `test` (135) / `test:integration` (34 passed, 1 skipped) / `build` pass. E2E N/A.

### Issues

ADR-011 remains OPEN. Currency master FK for reporting currency remains TASK-014. Rounding tolerance is a placeholder only (TASK-019). File retention and security policy settings from [[Settings]] were not in TASK-013 scope.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-014 Currency Master]]
