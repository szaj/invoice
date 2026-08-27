---
type: task
status: complete
phase: 7
module: compliance
depends_on:
  - TASK-072
  - TASK-012
tags:
  - task
---

# TASK-073 — Compliance Notes and Reason Codes

Status: COMPLETE

Phase: 7 ([[Phase 07 Compliance and Audit]])

## Objective

Approve or flag with notes, reason codes, and resolution notes.

## Source Documents

- [[Compliance]]
- [[Audit Logs]]

## Dependencies

[[TASK-072 Compliance Review Queue]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Internal compliance notes; reason codes; evidence/attachment references if enabled; audit events.

### Excluded

Manipulating audit logs.

## Database Changes

compliance_reviews notes/reason/reviewer/timestamps.

## Backend

Status update and notes APIs.

## Frontend

API this cycle.

## Authorization

Admin and Compliance only.

## Business Rules

BR-015.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Approve/flag writes audit events.

### Authorization

Staff denied.

### E2E

E2E-06.

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

- `prisma/migrations/20260827170000_compliance_notes_reason_codes/migration.sql`
- `src/app/api/compliance/notes/route.ts`
- `tests/unit/compliance-status.test.ts` (extended)
- `tests/integration/compliance-notes.test.ts`

### Files Modified

- `prisma/schema.prisma`
- `src/domain/compliance/types.ts`
- `src/domain/compliance/schema.ts`
- `src/domain/audit/types.ts`
- `src/server/compliance/compliance-repository.ts`
- `src/server/compliance/compliance-service.ts`
- `src/app/api/compliance/status/route.ts`
- `tests/unit/compliance-queue.test.ts`
- Current-state docs (Architecture, Implementation Status, Plan, Development Log, Compliance module, Phase 07)

### Migrations

`20260827170000_compliance_notes_reason_codes` — adds notes, reason, resolution_notes, evidence_refs to compliance_reviews.

### APIs

- `POST /api/compliance/status` — optional notes/reason/resolutionNotes/evidenceRefs on status change
- `POST /api/compliance/notes` — add notes without status change
- `GET /api/compliance/notes` — list review history for a subject

### Tests

- Unit: approve/flag with notes + audit; notes API; Staff denied
- Integration: approve/flag/notes write audit events; Staff denied (`RUN_DB_INTEGRATION=true`)

### Issues

None. Evidence refs accepted as storage-key strings; upload UI remains later. Full E2E-06 deferred to UI/E2E tasks.

### Commit

Not committed in this cycle.

## Next Recommended Task

[[TASK-074 Compliance Review UI]]
