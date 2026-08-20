---
type: task
status: complete
phase: 1
module: platform
depends_on:
  - TASK-001
tags:
  - task
---

# TASK-002 — Database Foundation

Status: COMPLETE

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

- [x] Required schema changes completed — foundation migration (`pgcrypto` only); no domain tables
- [x] Backend/domain implementation completed — Prisma client boundary; no domain APIs
- [x] UI completed where applicable — N/A
- [x] Server-side authorization enforced — N/A
- [x] Business rules enforced — Decimal/NUMERIC conventions; no Float money types
- [x] Tests added — env/schema unit tests; live Prisma connectivity gated by `RUN_DB_INTEGRATION`
- [x] Relevant tests passing — unit tests passing; live Supabase connectivity and foundation migration verified
- [x] Documentation updated
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required — ADR-002 implementation notes only (Prisma 7 URL split)

## Cursor Implementation Result

### Files Created

`prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations/20260820120000_database_foundation/migration.sql`, `src/server/db/client.ts`, `src/server/db/conventions.ts`, `docs/Technical/Database.md`, unit and integration tests.

### Files Modified

Env config, `.env.example`, package scripts, CI, gitignore, README, vault control notes, ADR-002 consequences.

### Migrations

`20260820120000_database_foundation` — `CREATE EXTENSION IF NOT EXISTS pgcrypto`. Applied to Supabase PostgreSQL (`prisma migrate dev`: database in sync). Confirmed in `_prisma_migrations` by integration tests.

### APIs

None.

### Tests

`pnpm typecheck`, `pnpm lint`, `pnpm test` (18 passed), `pnpm build`, `pnpm prisma generate`, `pnpm prisma validate`. Live connectivity: `RUN_DB_INTEGRATION=true pnpm test:integration` — 3 passed (runtime `DATABASE_URL`, Prisma `SELECT 1`, foundation migration row).

### Issues

Integration tests originally failed because Vitest did not load `.env` / `.env.local`. Fixed with centralized `loadEnvFiles()` and `vitest.integration.config.mts`. Unit tests remain isolated from developer database credentials.

### Commit

Prepared message: `feat(TASK-002): establish Prisma database foundation`

## Next Recommended Task

[[TASK-003 Authentication Base]]
