---
type: task
status: not-started
phase: 7
module: audit
depends_on:
  - TASK-012
tags:
  - task
---

# TASK-076 — Audit Log Viewer

Status: NOT STARTED

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

- [ ] Required schema changes completed
- [ ] Backend/domain implementation completed
- [ ] UI completed where applicable
- [ ] Server-side authorization enforced
- [ ] Business rules enforced
- [ ] Tests added
- [ ] Relevant tests passing
- [ ] Documentation updated
- [ ] [[03 Current Implementation Status]] updated
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

[[TASK-077 Dashboard KPIs]]
