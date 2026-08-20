---
type: task
status: complete
phase: 2
module: currency
depends_on:
  - TASK-017
tags:
  - task
---

# TASK-018 — Effective Rate Selection

Status: COMPLETE

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Select the active rate for a currency pair at a given timestamp.

## Source Documents

- [[Currency and Conversion]]
- [[Error Handling]]
- [[Business Rules]]

## Dependencies

[[TASK-017 Fixed Rate Versioning]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Immediate or scheduled effective from; mid-period changes affect only transactions at/after activation; same-currency rate is 1.000000.

### Excluded

Applying today's rate to historical payments or refunds.

## Database Changes

Read model over valid_from/valid_to/status.

## Backend

Domain service resolve_rate(pair, at). If missing, block conversion with a clear Admin message.

## Frontend

None required.

## Authorization

All later conversion paths must use this service.

## Business Rules

BR-022.

## Error Handling

Missing rate blocks conversion. Never substitute a market rate.

## Tests

### Unit

Scheduled, expired, current, missing, same-currency.

### Integration

N/A

### Authorization

N/A

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

`src/domain/fixed-rates/resolve-rate.ts`, `src/server/fixed-rates/resolve-rate-service.ts`, `tests/unit/resolve-rate.test.ts`.

### Files Modified

`src/domain/fixed-rates/types.ts` (effective-rate result + missing message); repository `listRatesForPair`; schema comments; minor `CurrencyWriteFormValues` type fix for typecheck. [[Currency and Conversion]], [[Error Handling]], [[Database]], [[API and Integrations]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], [[06 Development Log]], ADR-011 note, [[TASK-018 Effective Rate Selection]].

### Migrations

None. Read model over existing `fixed_conversion_rates.valid_from` / `valid_to` / `status`.

### APIs

None. Domain/service only: `selectEffectiveRate` / `resolveFixedConversionRate(from, to, at)`. Later conversion paths must call this. No payment/settlement application in this task.

### Tests

Unit: same-currency `1.000000000000`; current ACTIVE; EXPIRED historical window; scheduled before/after `validFrom`; missing blocks with Admin message (never market FX). Integration N/A. `pnpm typecheck` / `lint` / `format:check` / `test` (154) / `RUN_DB_INTEGRATION=true test:integration` (40 passed, 1 skipped) / `build` pass.

### Issues

Payment conversion and settlement remain later. Money formula helpers are TASK-019. ADR-011 remains OPEN.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-019 Money Calculation Utilities]]
