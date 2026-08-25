---
type: task
status: complete
phase: 1
module: auth
depends_on:
  - TASK-005
tags:
  - task
---

# TASK-006 — User Management

Status: COMPLETE

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Admin can create, edit, suspend, and reset users.

## Source Documents

- [[Roles and Permissions]]
- [[Settings]]
- [[Screen Inventory]]
- [[Audit Logs]]

## Dependencies

[[TASK-005 Roles and Permissions Model]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Account fields from [[Roles and Permissions]] 4.1 except company assignment (next tasks). Optional MFA status field; do not require MFA for all users.

### Excluded

Company assignment. Full MFA challenge productization beyond the optional field/flag.

## Database Changes

users fields from [[Data Model]].

## Backend

Admin CRUD, suspend/reset under /users.

## Frontend

Users list/create/edit.

## Authorization

Only Admin manages users.

## Business Rules

Least privilege.

## Error Handling

Non-Admin user-admin attempts return 403.

## Tests

### Unit

N/A

### Integration

User CRUD happy path.

### Authorization

Non-Admin cannot manage users.

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

`src/domain/users/*`, `src/server/users/{user-repository,user-service,actions}.ts`, `src/lib/supabase/admin-client.ts`, `src/server/auth/active-user.ts`, `src/app/(app)/users/**`, `src/app/api/users/**`, `prisma/migrations/20260820220000_user_management/`, `tests/unit/users-management.test.ts`, `tests/integration/users-management.test.ts`, `src/domain/ops/bootstrap-admin.ts`, `src/ops/bootstrap-admin-store.ts`, `scripts/bootstrap-admin.ts`, `tests/unit/bootstrap-admin.test.ts`, `tests/integration/bootstrap-admin.test.ts`.

### Files Modified

Prisma `User` fields (`employee_id`, `mfa_enabled`, `created_by_user_id`), env `SUPABASE_SERVICE_ROLE_KEY`, login/suspend gates, app layout active-user check, home Admin link, identity store status lookup, auth login tests, package script `bootstrap:admin`, [[Authentication]], [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], [[06 Development Log]].

### Migrations

`20260820220000_user_management` — `users.employee_id`, `users.mfa_enabled`, `users.created_by_user_id` (FK to `users`). Applied with `pnpm prisma:migrate:deploy`. No company assignment, credentials, or `audit_logs` table.

### APIs

- `GET/POST /api/users`
- `GET/PATCH /api/users/[id]`
- `POST /api/users/[id]/suspend`
- `POST /api/users/[id]/reset-password`

All require `user.manage` (Admin). Server Actions mirror the same gates. Non-Admin → 403.

### Tests

Unit: Admin allowed; Compliance/Staff denied; create/suspend/reset; suspended login rejected. Integration (DB): Admin CRUD/suspend/reset-required; Staff denied; migration recorded. Auth integration suite still green. E2E N/A.

### Issues

US-007–010 remain OPEN with default deny. Company assignment deferred to TASK-008. MFA is status-only. Full audit store remains TASK-012 (safe Pino events only). Admin Auth provisioning requires `SUPABASE_SERVICE_ROLE_KEY` for live create/email flows; integration CRUD uses a mocked provisioner.

Operational completion: `pnpm bootstrap:admin` assigns the first system ADMIN in the application DB when User Management cannot yet run (`user.manage` chicken-and-egg). It does not create Auth users, touch Auth metadata, accept passwords, or bypass runtime authorization.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-007 Company CRUD]]
