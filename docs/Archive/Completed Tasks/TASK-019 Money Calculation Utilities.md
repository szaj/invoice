---
type: task
status: complete
phase: 2
module: currency
depends_on:
  - TASK-014
  - TASK-013
tags:
  - task
---

# TASK-019 — Money Calculation Utilities

Status: COMPLETE

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Provide a centralized server-side financial calculation/domain layer using **Prisma Decimal** / PostgreSQL NUMERIC.

## Source Documents

- [[Data Model]]
- [[Currency and Conversion]]
- [[Business Rules]]
- [[Testing]]
- [[05 Architecture Decisions]]
- [[Engineering Rules]]

## Dependencies

[[TASK-014 Currency Master]], [[TASK-013 Core System Settings]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Prisma Decimal arithmetic; currency-code pairing; rounding from system settings; converted_settlement_amount = invoice_amount_applied × fixed_conversion_rate with merchant fee excluded. No JavaScript `number` math for authoritative money.

### Excluded

JavaScript floating-point money. Client-trusted totals. Duplicating formulas in React components, Route Handlers, Server Actions, or payment adapters.

## Database Changes

None beyond decimal types.

## Backend

Shared domain money helpers (Vitest). Never JS float assertions.

## Frontend

Display-only formatting; backend remains source of truth.

## Authorization

N/A

## Business Rules

BR-009, BR-013, BR-020.

## Error Handling

N/A

## Tests

### Unit

Conversion formula, same-currency 1.000000, fee exclusion, rounding.

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

`src/domain/money/{types,decimal,round,convert,outstanding,format,index}.ts`, `tests/unit/money.test.ts`.

### Files Modified

[[Currency and Conversion]], [[Data Model]], [[Engineering Rules]], [[Testing]], [[Settings]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], [[06 Development Log]], ADR-004 consequences, [[TASK-019 Money Calculation Utilities]].

### Migrations

None.

### APIs

None. Domain helpers only — later invoice/payment modules must call `@/domain/money` (never JS float math in Route Handlers / React / adapters).

### Tests

Unit: conversion formula; same-currency 1; fee exclusion; half-up rounding; settings tolerance; outstanding (BR-009); mixed-currency guard (BR-013). Integration N/A. `pnpm typecheck` / `lint` / `format:check` / `test` (164) / `RUN_DB_INTEGRATION=true test:integration` (40 passed, 1 skipped) / `build` pass.

### Issues

Invoice line/tax totals, payment allocation workflows, and settlement charging remain later tasks. ADR-011 remains OPEN.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-020 Settlement Currency Configuration]]
