---
type: task
status: not-started
phase: 9
module: ops
depends_on:
  - TASK-101
  - TASK-102
  - TASK-096
tags:
  - task
---

# TASK-103 — Production Deployment

Status: NOT STARTED

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

Production environment: **Caddy + Next.js container + worker container + Redis container**, managed **Supabase PostgreSQL** off-VPS, live payment credentials, HTTPS, protected data.

## Source Documents

- [[Deployment]]
- [[Security]]
- [[Out of Scope]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-101 Backup and Recovery]], [[TASK-102 Staging UAT Environment]], [[TASK-096 E2E Test Suite]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Live credentials, monitoring (Sentry), backups, least-privilege cloud credentials. Linux VPS + Docker + Caddy. Exact VPS vendor may be chosen operationally.

### Excluded

Shipping out-of-scope Version 1 features. Customer portal. Live FX. Hosting Supabase PostgreSQL on the application VPS.

## Database Changes

Production database/storage.

## Backend

Production deployment.

## Frontend

Production UI.

## Authorization

HTTPS only. Least privilege.

## Business Rules

No customer portal. No live FX.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

N/A

### E2E

Production checklist verified; implementation status updated.

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

None — Version 1 task list complete.
