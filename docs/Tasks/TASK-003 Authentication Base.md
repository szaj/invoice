---
type: task
status: not-started
phase: 1
module: auth
depends_on:
  - TASK-002
tags:
  - task
---

# TASK-003 — Authentication Base

Status: NOT STARTED

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

[[TASK-004 Password Reset and Session Controls]]
