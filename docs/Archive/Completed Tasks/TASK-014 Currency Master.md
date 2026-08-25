---
type: task
status: complete
phase: 2
module: currency
depends_on:
  - TASK-013
tags:
  - task
---

# TASK-014 — Currency Master

Status: COMPLETE

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Create the global currency catalog with defaults USD, AED, PKR, GBP, AUD.

## Source Documents

- [[Currency and Conversion]]
- [[Data Model]]
- [[Settings]]

## Dependencies

[[TASK-013 Core System Settings]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

code, name, symbol, decimal precision, active status; Admin add/disable.

### Excluded

Company enablement. Rate versions. Live FX.

## Database Changes

currencies.

## Backend

GET/POST/PATCH currencies.

## Frontend

Currencies list/create/edit/disable.

## Authorization

Admin only for create/disable.

## Business Rules

Disabled currencies remain for historical display later. BR-011.

## Error Handling

N/A

## Tests

### Unit

Default five currencies present.

### Integration

Currency CRUD.

### Authorization

Non-Admin cannot create currencies.

### E2E

E2E-09 precursor.

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

`src/domain/currencies/{types,schema}.ts`, `src/server/currencies/{currency-repository,currency-service,actions}.ts`, `src/app/api/currencies/**`, `src/app/(app)/settings/currencies/**`, `prisma/migrations/20260820290000_currency_master/`, `tests/unit/currencies.test.ts`, `tests/integration/currencies.test.ts`.

### Files Modified

Prisma `Currency` model; audit currency actions; home Admin link; system-settings integration table assertion. [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Settings]], [[Currency and Conversion]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], ADR-011 note (still OPEN), [[06 Development Log]].

### Migrations

`20260820290000_currency_master` — `currencies` table with seeded USD, AED, PKR, GBP, AUD (ACTIVE). Applied with `pnpm prisma:migrate:deploy`. No `company_currencies`, fixed rates, settlement config, or live FX. ADR-011 remains OPEN.

### APIs

- `GET/POST /api/currencies`
- `GET/PATCH /api/currencies/{id}` (PATCH with `{ status }` disables/activates)

All require `currency.manage` (Admin). Non-Admin → 403. Soft-disable only (no hard-delete). Create/update/status write audit events.

### Tests

Unit: default five codes; schema; Admin CRUD + audit; Staff create denied. Integration: seed present; Admin CRUD; Staff create denied; no company_currencies/rates tables. `pnpm typecheck` / `lint` / `format:check` / `test` (139) / `test:integration` (36 passed, 1 skipped) / `build` pass. E2E N/A (precursor only).

### Issues

ADR-011 remains OPEN. Company currency enablement is TASK-015. Fixed rates TASK-016+. Reporting currency on `system_settings` is still a free code (not FK-validated against catalog in this task).

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-015 Company Currency Configuration]]
