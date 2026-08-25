---
type: task
status: complete
phase: 1
module: auth
depends_on:
  - TASK-002
tags:
  - task
---

# TASK-003 — Authentication Base

Status: COMPLETE

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Implement secure internal login and logout using **Supabase Auth** for identity. Application authorization remains a later domain concern and must not be treated as solved by authentication.

## Source Documents

- [[Roles and Permissions]]
- [[Security]]
- [[API and Integrations]]
- [[Screen Inventory]]
- [[05 Architecture Decisions]]
- [[Engineering Rules]]

## Dependencies

[[TASK-002 Database Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Supabase Auth login/logout and sessions; HTTPS-only non-local; rate-limited login; application `users` row with a stable link to the Supabase Auth user identifier. `authenticated` is not `authorized`.

### Excluded

Customer portal auth. Required MFA for all users. Using Supabase Auth as the RBAC/company-permission system. A second application password store as login authority.

## Database Changes

users fields needed for identity mapping: id, name, email, supabase auth user identifier, status, last_login_at. Do not treat application `password_hash` as the login credential store; credentials live in Supabase Auth. [[05 Architecture Decisions#ADR-003 — Authentication|ADR-003]]

## Backend

Next.js Route Handlers / Server Actions that coordinate Supabase Auth login/logout. Identity only — no company-permission grants here.

## Frontend

Login and logout screens.

## Authorization

Unauthenticated users cannot access application routes.

## Business Rules

No customer portal. [[Out of Scope]]

## Error Handling

Invalid credentials do not reveal whether the email exists beyond a generic failure, unless the spec later says otherwise. Rate-limit login.

## Tests

### Unit

Identity mapping is stable; unauthenticated access denied.

### Integration

Login/logout against a local user.

### Authorization

Unauthenticated access denied.

### E2E

N/A this cycle.

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

`src/domain/auth/*`, `src/server/auth/*`, `src/lib/supabase/*`, `src/config/env-schema.ts`, `src/config/public-env.ts`, `src/proxy.ts`, `src/app/login/*`, `src/app/(app)/*`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/components/ui/{input,label,card}.tsx`, `prisma/migrations/20260820193000_authentication_base/`, `docs/Technical/Authentication.md`, auth unit/integration tests.

### Files Modified

Env validation, Prisma schema, logger redaction, docs (Home, status, plan, security, API, database, README), Playwright shell spec.

### Migrations

`20260820193000_authentication_base` — `users` identity table only.

### APIs

`POST /api/auth/login`, `POST /api/auth/logout`, Server Actions `loginAction` / `logoutAction`.

### Tests

Unit coverage for validation, login service, rate limit, HTTPS cookies, missing identity, no public signup, and no Auth-metadata authorization. DB identity-mapping integration gated on `RUN_DB_INTEGRATION`. Live Supabase login gated on `RUN_AUTH_INTEGRATION` plus test credentials.

Live Supabase authentication verified (2026-08-20): valid login, invalid password (generic failure), server `getUser()` session recognition, logout clearing the Auth session, and `users` identity mapping without role/company/permission columns.

### Issues

None remaining for TASK-003 live verification.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-004 Password Reset and Session Controls]]
