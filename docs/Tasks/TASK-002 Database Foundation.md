---
type: task
status: not-started
phase: 1
module: platform
depends_on:
  - TASK-001
tags:
  - task
---

# TASK-002 — Database Foundation

Status: NOT STARTED

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Establish Prisma + Supabase PostgreSQL conventions and migration tooling required by the logical data model.

## Source Documents

- [[Data Model]]
- [[Deployment]]
- [[Security]]
- [[05 Architecture Decisions]]
- [[Engineering Rules]]

## Dependencies

[[TASK-001 Repository Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Prisma schema project against **Supabase PostgreSQL**; UUID-recommended identifiers for externally referenced records; created_at/updated_at in UTC; Prisma Decimal mapped to NUMERIC/DECIMAL per [[05 Architecture Decisions#ADR-004 — Money representation|ADR-004]]; convention that transactional tables will carry company_id; PostgreSQL constraints in addition to application validation.

### Excluded

Implementing module tables (users/companies/invoices). Live FX. A second application database.

## Database Changes

Prisma tooling only. Vendor is accepted: Supabase PostgreSQL ([[05 Architecture Decisions#ADR-002 — Database|ADR-002]]). No business-entity tables yet.

## Backend

Empty Prisma schema project that can add later entities. No domain APIs. Do not put domain logic in Route Handlers.

## Frontend

None.

## Authorization

N/A

## Business Rules

Never use JavaScript floating-point for money. Use Prisma Decimal / PostgreSQL NUMERIC. [[Data Model]] 17.2. [[Engineering Rules]]

## Error Handling

Fail closed if tooling cannot apply a migration in local env.

## Tests

### Unit

Smoke that Prisma migrations run against the configured local/Supabase PostgreSQL database.

### Integration

Migration apply/rollback smoke (Vitest).

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

[[TASK-003 Authentication Base]]
