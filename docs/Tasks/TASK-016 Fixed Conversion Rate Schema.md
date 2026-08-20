---
type: task
status: not-started
phase: 2
module: currency
depends_on:
  - TASK-014
tags:
  - task
---

# TASK-016 — Fixed Conversion Rate Schema

Status: NOT STARTED

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

[[TASK-017 Fixed Rate Versioning]]
