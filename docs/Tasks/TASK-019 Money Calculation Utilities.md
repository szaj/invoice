---
type: task
status: not-started
phase: 2
module: currency
depends_on:
  - TASK-014
  - TASK-013
tags:
  - task
---

# TASK-019 — Money Calculation Utilities

Status: NOT STARTED

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

[[TASK-020 Settlement Currency Configuration]]
