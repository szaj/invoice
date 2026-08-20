---
type: task
status: complete
phase: 1
module: companies
depends_on:
  - TASK-008
tags:
  - task
---

# TASK-009 — Tenant Isolation and Company Context

Status: COMPLETE

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Enforce company context on every company-scoped request and provide the header company switcher.

## Source Documents

- [[Companies and Brands]]
- [[Roles and Permissions]]
- [[Security]]
- [[Business Rules]]
- [[Error Handling]]

## Dependencies

[[TASK-008 User Company Assignments]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Switcher; Admin All Companies for consolidated reporting only; transactional actions require one concrete company; context change refreshes company-scoped data; server-side company_id checks.

### Excluded

Allowing transactional writes in All Companies context.

## Database Changes

No new financial tables.

## Backend

Reject invalid company context server-side on every company-scoped request.

## Frontend

Header company switcher on authenticated layout. [[Screen Inventory]]

## Authorization

Frontend hiding is not authorization.

## Business Rules

BR-016.

## Error Handling

Invalid company context rejected. [[Error Handling]]

## Tests

### Unit

Context resolver unit tests.

### Integration

Transactional API without concrete company rejected.

### Authorization

Cross-company IDOR denied.

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

`src/domain/company-context/*`, `src/server/company-context/*`, `src/app/(app)/company-switcher.tsx`, `src/app/(app)/app-header.tsx`, `src/app/api/company-context/route.ts`, `src/app/api/company-context/transactional/route.ts`, `tests/unit/company-context.test.ts`, `tests/integration/company-context.test.ts`.

### Files Modified

Authenticated `(app)` layout header shell; home page shows active context. Company store `listCompaniesByIds`. [[Authorization]], [[Security]], [[API and Integrations]], [[Error Handling]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[06 Development Log]].

### Migrations

None. Company context is an httpOnly preference cookie (`app-company-context`), not a database table. No currencies, invoices, payments, branding, or reporting groups.

### APIs

- `GET /api/company-context` — current selection + switcher company list (Admin all / assigned only).
- `POST /api/company-context` — set selection (`all` or company UUID); invalid/inaccessible → 400.
- `POST /api/company-context/transactional` — representative transactional gate: requires concrete company matching context + `assertCompanyAccess` (All Companies → 400; IDOR → 403).
- Server Action `setCompanyContextAction` for the header switcher; revalidates layout on change.

### Tests

Unit: Admin defaults to All Companies; Staff defaults to first assigned; Staff cannot select All Companies or unassigned IDs; reporting-group fields ignored; transactional All Companies rejected; cross-company IDOR denied. Integration (DB): switcher lists Admin all vs Staff assigned; transactional without concrete company rejected; IDOR denied. E2E N/A.

### Issues

Later customer/invoice/payment modules must call `assertTransactionalCompanyScope` / `requireConcreteCompanyId`. US-007–010 remain OPEN with default deny. `password_reset_required` remains workflow-only. Audit store remains TASK-012.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-010 Company Branding Configuration]]
