---
type: task
status: not-started
phase: 7
module: compliance
depends_on:
  - TASK-072
  - TASK-012
tags:
  - task
---

# TASK-073 — Compliance Notes and Reason Codes

Status: NOT STARTED

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

[[TASK-074 Compliance Review UI]]
