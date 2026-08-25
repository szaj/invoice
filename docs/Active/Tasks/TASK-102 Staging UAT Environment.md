---
type: task
status: not-started
phase: 9
module: ops
depends_on:
  - TASK-001
  - TASK-049
tags:
  - task
---

# TASK-102 — Staging UAT Environment

Status: NOT STARTED

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

Production-like staging/UAT on **Docker + Caddy** (or equivalent compose) for business acceptance and gateway sandbox tests. Managed Supabase PostgreSQL remains external.

## Source Documents

- [[Deployment]]
- [[Testing]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-001 Repository Foundation]], [[TASK-049 Gateway Configuration Per Company]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Separate from production credentials; sandbox gateways; Next.js + worker + Redis containers as in [[05 Architecture Decisions#ADR-017 — Deployment|ADR-017]]. Exact VPS vendor is not required for UAT.

### Excluded

Using live payment credentials in UAT.

## Database Changes

UAT database/storage.

## Backend

Deployable UAT environment.

## Frontend

UAT URL for business users.

## Authorization

UAT data isolation.

## Business Rules

Environments table in [[Deployment]].

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Smoke test against UAT.

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

[[TASK-103 Production Deployment]]
