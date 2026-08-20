---
type: task
status: complete
phase: 2
module: currency
depends_on:
  - TASK-014
tags:
  - task
---

# TASK-016 — Fixed Conversion Rate Schema

Status: COMPLETE

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Store Admin-defined fixed conversion rates. No live FX provider.

## Source Documents

- [[Currency and Conversion]]
- [[Data Model]]
- [[Business Rules]]

## Dependencies

[[TASK-014 Currency Master]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

fixed_conversion_rates: from/to, fixed_rate, version_no, frequency_label, valid_from, valid_to, status, notes, created_by, created_at. Rate precision 8–12 decimals.

### Excluded

Market/gateway rates. Editing a historical version in place.

## Database Changes

fixed_conversion_rates.

## Backend

Fixed-rates create endpoint.

## Frontend

Settings: create fixed rate.

## Authorization

Admin only.

## Business Rules

BR-020, BR-022. Version 1 uses Admin-defined fixed rates only.

## Error Handling

Never fetch, guess, or substitute a market/gateway rate. [[Error Handling]]

## Tests

### Unit

Precision/decimal tests.

### Integration

Create rate.

### Authorization

Non-Admin denied.

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
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

`src/domain/fixed-rates/{types,schema}.ts`, `src/server/fixed-rates/{fixed-rate-repository,fixed-rate-service,actions}.ts`, `src/app/api/fixed-conversion-rates/route.ts`, `src/app/(app)/settings/fixed-rates/new/{page,fixed-rate-create-form}.tsx`, `prisma/migrations/20260820310000_fixed_conversion_rate_schema/`, `tests/unit/fixed-rates.test.ts`, `tests/integration/fixed-rates.test.ts`.

### Files Modified

Prisma `FixedConversionRate` model + enums; audit `fixed_rates.created`; home Create fixed rate link; currencies page copy; prerequisite integration table assertions. [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Currency and Conversion]], [[Settings]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], ADR-004/ADR-011 notes as needed, [[TASK-016 Fixed Conversion Rate Schema]].

### Migrations

`20260820310000_fixed_conversion_rate_schema` — `fixed_conversion_rates` with `NUMERIC(20, 12)` `fixed_rate`, version/frequency/valid range/status/notes/created_by. Applied with `pnpm prisma:migrate:deploy`. No expire-previous, effective selection, settlement, or payment conversion. No live FX.

### APIs

- `POST /api/fixed-conversion-rates`

Requires `currency.manage` (Admin). Creates an append-only rate row with auto-incremented `version_no` per pair. Does not expire prior versions (TASK-017). Does not PATCH historical rates. Never fetches market/gateway rates. Audits `fixed_rates.created`.

### Tests

Unit: Decimal precision up to 12 places; schema from≠to / date order; Staff denied; Admin create + audit. Integration: migration recorded; create rate; Non-Admin denied. `pnpm typecheck` / `lint` / `format:check` / `test` (146) / `RUN_DB_INTEGRATION=true test:integration` (40 passed, 1 skipped) / `build` pass. E2E N/A.

### Issues

Expire-previous-on-create and version history list remain TASK-017. Effective rate selection is TASK-018. ADR-011 remains OPEN.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-017 Fixed Rate Versioning]]
