---
type: task
status: not-started
phase: 2
module: currency
depends_on:
  - TASK-017
tags:
  - task
---

# TASK-018 — Effective Rate Selection

Status: NOT STARTED

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

[[TASK-019 Money Calculation Utilities]]
