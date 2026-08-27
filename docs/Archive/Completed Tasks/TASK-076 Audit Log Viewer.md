---
type: task
status: complete
phase: 7
module: audit
depends_on:
  - TASK-012
tags:
  - task
---

# TASK-076 — Audit Log Viewer

Status: COMPLETE

Phase: 7 ([[Phase 07 Compliance and Audit]])

## Objective

Read-only filterable audit viewer.

## Source Documents

- [[Audit Logs]]
- [[Roles and Permissions]]
- [[Screen Inventory]]
- [[API and Integrations]]

## Dependencies

[[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Filters; read-only API; Admin all; Compliance assigned; Staff own activity only/none (US-010) — do not invent a grant.

### Excluded

Any update/delete of audit rows. Showing unmasked secrets.

## Database Changes

Read path over audit_logs.

## Backend

GET audit filter endpoint.

## Frontend

Audit Logs screen.

## Authorization

Restricted access; masked sensitive values.

## Business Rules

Append-only preserved.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Viewer is read-only.

### Authorization

Role-scoped reads.

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

- `src/domain/audit/viewer.ts`
- `src/server/audit/audit-query-service.ts`
- `src/server/audit/actions.ts`
- `src/app/api/audit/route.ts`
- `src/app/(app)/audit/page.tsx`
- `src/app/(app)/audit/audit-log-filters.tsx`
- `src/app/(app)/audit/audit-event-detail.tsx`
- `tests/unit/audit-viewer.test.ts`
- `tests/unit/audit-ui-authz.test.ts`
- `tests/integration/audit-viewer.test.ts`

### Files Modified

- `src/domain/audit/types.ts`
- `src/domain/audit/schema.ts`
- `src/server/audit/audit-repository.ts`
- `src/lib/time.ts`
- `src/components/layout/nav-config.ts`
- `src/components/data/status-badge.tsx`
- `src/app/(app)/page.tsx`
- `tests/unit/audit-events.test.ts`
- `docs/01 Current Architecture.md`
- `docs/03 Current Implementation Status.md`
- `docs/04 Current Plan.md`
- `docs/05 Architecture Decisions.md`
- `docs/06 Development Log.md`
- `docs/00 Home.md`
- `docs/Active/Modules/Audit Logs.md`
- `docs/Active/Tasks/Phase 07 Compliance and Audit.md`
- `docs/Active/Unresolved/Unresolved Source Items.md`

### Migrations

None. Read path over existing `audit_logs` indexes.

### APIs

- `GET /api/audit` — read-only filtered list; requires `audit.read`; Admin all; Compliance assigned companies; Staff 403 (US-010)

### Tests

- `tests/unit/audit-viewer.test.ts`
- `tests/unit/audit-ui-authz.test.ts`
- `tests/unit/audit-events.test.ts` (GET-only route surface)
- `tests/integration/audit-viewer.test.ts`

### Issues

US-010 remains OPEN: Staff `audit.read` stays denied; no own-activity grant invented.

### Commit

Not committed (commit only on request).

## Next Recommended Task

[[TASK-077 Dashboard KPIs]]
