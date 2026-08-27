---
type: task
status: complete
phase: 7
module: compliance
depends_on:
  - TASK-072
  - TASK-073
tags:
  - task
---

# TASK-074 — Compliance Review UI

Status: COMPLETE

Phase: 7 ([[Phase 07 Compliance and Audit]])

## Objective

Review queue, record detail, approve/flag, and notes screens.

## Source Documents

- [[Compliance]]
- [[Screen Inventory]]

## Dependencies

[[TASK-072 Compliance Review Queue]], [[TASK-073 Compliance Notes and Reason Codes]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Review queue, record detail, approve/flag, notes.

### Excluded

Audit log deletion UI.

## Database Changes

None.

## Backend

Consume compliance APIs.

## Frontend

Compliance screens from [[Screen Inventory]].

## Authorization

Staff has no review actions.

## Business Rules

N/A

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Staff cannot open unassigned items.

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

- `src/app/(app)/compliance/page.tsx` — review queue
- `src/app/(app)/compliance/compliance-queue-filters.tsx` — queue filters
- `src/app/(app)/compliance/[subjectType]/[subjectId]/page.tsx` — record detail
- `src/app/(app)/compliance/[subjectType]/[subjectId]/compliance-review-panel.tsx` — approve/flag + notes
- `src/server/compliance/actions.ts` — UI loaders and mutations
- `tests/unit/compliance-ui-authz.test.ts` — Staff denied / unassigned company authz

### Files Modified

- `src/domain/compliance/schema.ts` — queue searchParams + subject URL helpers
- `src/components/layout/nav-config.ts` — Compliance nav (`compliance.review`)
- `src/app/(app)/invoices/[id]/page.tsx` — Compliance review link
- `src/app/(app)/payments/[id]/page.tsx` — Compliance review link
- `src/app/(app)/customers/[id]/page.tsx` — Compliance review link

### Migrations

None.

### APIs

Consumes existing `GET /api/compliance/queue`, `POST /api/compliance/status`, `GET|POST /api/compliance/notes` via server actions.

### Tests

- `tests/unit/compliance-ui-authz.test.ts` (passed)
- Re-ran `tests/unit/compliance-queue.test.ts`, `tests/unit/compliance-status.test.ts` (passed)
- typecheck, lint, format:check, build (passed)

### Issues

Screen Inventory not present in active docs; UI built from [[Compliance]] + existing list/detail design-system patterns.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-075 Compliance Export]]
