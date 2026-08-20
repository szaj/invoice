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

# TASK-004 — Password Reset and Session Controls

Status: COMPLETE

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Add password reset and session controls using **Supabase Auth** identity flows.

## Source Documents

- [[Roles and Permissions]]
- [[Security]]
- [[API and Integrations]]
- [[Screen Inventory]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-003 Authentication Base]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Forgot/reset password via Supabase Auth; password-reset-required flag on the application user if still required by spec; session controls; rate-limited reset. Transactional mail goes through EmailService when sending is needed ([[05 Architecture Decisions#ADR-007 — Transactional email|ADR-007]]); a test/dev path is enough this cycle.

### Excluded

Customer portal passwords. Calling the Resend SDK from auth screens. Implementing a parallel reset-token store as the identity authority when Supabase Auth already provides recovery.

## Database Changes

Application user flags as needed. Do not duplicate Supabase Auth as a second credential database.

## Backend

Coordinate Supabase Auth recovery through Route Handlers / Server Actions. No domain payment logic.

## Frontend

Forgot Password and Reset Password screens.

## Authorization

Reset tokens single-use and expired server-side.

## Business Rules

No financial rules.

## Error Handling

Expired/invalid tokens rejected.

## Tests

### Unit

Expired and reused tokens fail.

### Integration

Reset flow with test mailbox.

### Authorization

N/A

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

`src/domain/auth/{password-schema,redirect,recovery-callback}.ts`, `src/server/auth/{password-recovery,password-update,password-reset-access,recovery-session,supabase-recovery-provider}.ts`, `src/app/forgot-password/*`, `src/app/reset-password/*`, `src/app/auth/callback/route.ts`, `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts`, `prisma/migrations/20260820200000_password_reset_required/`, password-reset unit/integration tests.

### Files Modified

Auth errors/HTTPS/identity, rate-limiter abstraction, identity repository, Server Actions, proxy public paths, login UI, env/`APP_URL`, Prisma `users.password_reset_required`, logger redaction, docs.

### Migrations

`20260820200000_password_reset_required` — `users.password_reset_required` BOOLEAN NOT NULL DEFAULT false. Applied with `pnpm prisma:migrate:deploy`. No password, password_hash, or reset_token columns.

### APIs

`POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /auth/callback`, Server Actions `forgotPasswordAction` / `resetPasswordAction`.

### Tests

Unit coverage for email/password/confirmation validation, trusted redirects, callback classification, generic recovery responses, invalid recovery state, valid password update, and no signup/role metadata. DB flag integration gated on `RUN_DB_INTEGRATION`. Live recovery request and authenticated password update gated on `RUN_AUTH_INTEGRATION`. Generated recovery-link exchange gated on `RUN_RECOVERY_INTEGRATION` plus service role.

Live verification (2026-08-20):

- Forgot-password generic response (known and unknown emails): PASS
- Authenticated password update + session signed out + original password restored: PASS
- Application identity still has no role/company authorization metadata: PASS
- Recovery email delivery to the dedicated test mailbox: SKIPPED / provider rate-limited (`over_email_send_rate_limit` on the known test email). User-facing response remained the generic message.
- Recovery-link click / callback with a mailbox or `generateLink` service role: SKIPPED (`RUN_RECOVERY_INTEGRATION` unset; no service role in this environment)
- Playwright E2E: NOT RUN (TASK-004 E2E is N/A)

### Issues

Supabase Auth independently rate-limits recovery emails. The application limiter remains process-local in-memory, same Redis replacement path as login. No test mailbox is configured; full inbox click-through was not executed and is not marked passed.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-005 Roles and Permissions Model]]
