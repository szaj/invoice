---
type: task
status: not-started
phase: 1
module: auth
depends_on:
  - TASK-003
tags:
  - task
---

# TASK-004 — Password Reset and Session Controls

Status: NOT STARTED

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

[[TASK-005 Roles and Permissions Model]]
