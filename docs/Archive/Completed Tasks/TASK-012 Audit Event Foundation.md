---
type: task
status: complete
phase: 1
module: audit
depends_on:
  - TASK-003
tags:
  - task
---

# TASK-012 — Audit Event Foundation

Status: COMPLETE

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Create an append-only audit event store and write mandatory security/admin events that already exist.

## Source Documents

- [[Audit Logs]]
- [[Business Rules]]
- [[Security]]
- [[Data Model]]

## Dependencies

[[TASK-003 Authentication Base]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

audit_logs fields from [[Audit Logs]]; append-only from the application layer; mask secrets; UTC timestamps; login and user/company admin events.

### Excluded

Full audit viewer UI. Logging gateway secrets or raw card data.

## Database Changes

audit_logs. No ordinary update/delete APIs.

## Backend

Write events for login success/failure/logout, user create/role/company/status, company create/update/status.

## Frontend

None.

## Authorization

Audit access restricted; sensitive values masked.

## Business Rules

BR-015.

## Error Handling

Application API cannot update/delete audit rows.

## Tests

### Unit

Append-only enforcement.

### Integration

Audit write on login.

### Authorization

No update/delete via API.

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

`src/domain/audit/{types,mask,schema}.ts`, `src/server/audit/{audit-repository,audit-service}.ts`, `prisma/migrations/20260820270000_audit_event_foundation/`, `prisma/migrations/20260820270100_audit_event_no_fk/`, `tests/unit/audit-events.test.ts`, `tests/integration/audit-events.test.ts`, `tests/helpers/memory-audit-writer.ts`.

### Files Modified

Prisma `AuditLog` model; login/logout; user-service; company-service; auth request meta (IP/UA); prerequisite unit tests inject memory audit writer; reporting-groups integration expects `audit_logs`. [[Security]], [[API and Integrations]], [[Database]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-014 consequences, [[06 Development Log]].

### Migrations

`20260820270000_audit_event_foundation` — `audit_logs` append-only store (actor type, actor/company historical IDs, entity, action, old/new JSON, reason, IP, UA, correlation ID, UTC `occurred_at`). `20260820270100_audit_event_no_fk` — drops actor/company FKs so historical references survive lifecycle and system/login writes. Applied with `pnpm prisma:migrate:deploy`. No viewer API, currencies, invoices, or payments.

### APIs

No audit HTTP mutate/read APIs (viewer is TASK-076). Application writer is append-only; `update`/`delete` throw. Login/logout and Admin user/company mutations emit audit events. Secrets masked before persistence. Auth writes are best-effort; privileged Admin mutations require a successful audit write (BR-015).

### Tests

Unit: masking; append-only reject update/delete; login success/failure audit writes; no audit mutate routes. Integration (DB): migration recorded; login persists `audit_logs` row; append-only enforcement. `pnpm typecheck` / `lint` / `format:check` / `test` (131) / `test:integration` (32 passed, 1 skipped) / `build` pass. E2E N/A.

### Issues

US-010 Staff audit visibility remains OPEN (denied). Audit viewer UI remains TASK-076. Currency/invoice/payment/gateway mandatory events remain later tasks. Branding and reporting-group mutations were not wired here (out of TASK-012 backend list).

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-013 Core System Settings]]
