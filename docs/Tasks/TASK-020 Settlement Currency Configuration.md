---
type: task
status: not-started
phase: 2
module: currency
depends_on:
  - TASK-014
  - TASK-007
tags:
  - task
---

# TASK-020 — Settlement Currency Configuration

Status: NOT STARTED

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Configure settlement currencies separately per payment method/company. Initially USD and AED only unless expanded by Admin.

## Source Documents

- [[Currency and Conversion]]
- [[Payments]]
- [[Companies and Brands]]

## Dependencies

[[TASK-014 Currency Master]], [[TASK-007 Company CRUD]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Per-method settlement currency support flags. Initial USD and AED.

### Excluded

Gateway credential storage. Charging a customer.

## Database Changes

Supported settlement currencies on gateway config shape; credentials later.

## Backend

Configuration API without live charges.

## Frontend

Company payment-method settlement currency settings (enablement only).

## Authorization

Admin only.

## Business Rules

BR-006, BR-007.

## Error Handling

Reject a non-enabled settlement currency.

## Tests

### Unit

N/A

### Integration

Enablement persistence.

### Authorization

Non-enabled settlement currency rejected.

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

[[TASK-021 Currency Disable and Historical Visibility]]
