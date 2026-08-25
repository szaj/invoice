---
type: task
status: complete
phase: 1
module: auth
depends_on:
  - TASK-003
tags:
  - task
---

# TASK-005 — Roles and Permissions Model

Status: COMPLETE

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Implement Admin, Compliance, and Staff RBAC from the permission matrix.

## Source Documents

- [[Roles and Permissions]]
- [[Security]]
- [[Business Rules]]

## Dependencies

[[TASK-003 Authentication Base]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Role definitions and the matrix in [[Roles and Permissions]]. Record optional Staff policies from [[Unresolved Source Items]] as open policy, do not invent grants.

### Excluded

Company assignment UI. Financial module checks that need those modules.

## Database Changes

roles / permissions mapping.

## Backend

Enforce role checks in domain/API layers. Frontend hiding is not authorization.

## Frontend

None beyond what user management later needs.

## Authorization

Backend permission checks are mandatory. BR-016.

## Business Rules

BR-016. Customer hard-delete remains restricted as specified.

## Error Handling

403 on permission failure. [[Error Handling]]

## Tests

### Unit

Role helper unit tests.

### Integration

N/A

### Authorization

Admin vs Compliance vs Staff on a representative protected action.

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

`src/domain/authz/*`, `src/server/authz/{principal,require-permission}.ts`, `src/app/api/roles/route.ts`, `prisma/migrations/20260820210000_roles_and_permissions/`, `docs/Technical/Authorization.md`, `tests/unit/authz-roles.test.ts`, `tests/integration/authz-roles.test.ts`.

### Files Modified

Prisma `User.roleId` (nullable), architecture/identity tests, [[Authentication]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[Unresolved Source Items]] US-007–010.

### Migrations

`20260820210000_roles_and_permissions` — `roles`, `permissions`, `role_permissions`, optional `users.role_id`. Seeded Admin/Compliance/Staff and matrix grants. Applied with `pnpm prisma:migrate:deploy`. No company, customer, invoice, or payment tables. Optional Staff policies not granted.

### APIs

`GET /api/roles` — requires `user.manage` (Admin). Lists the role catalog. Not user CRUD.

### Tests

Unit coverage for the full matrix, open Staff policies denied, hard-delete always false, and Admin vs Compliance vs Staff on `user.manage`. DB seed verification gated on `RUN_DB_INTEGRATION`. E2E N/A.

### Issues

US-007–010 remain open product policy; Staff grants were not invented. Company assignment is not implemented. Login still does not assign a role.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-006 User Management]]
