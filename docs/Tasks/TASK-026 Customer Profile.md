---
type: task
status: not-started
phase: 3
module: customers
depends_on:
  - TASK-024
  - TASK-025
tags:
  - task
---

# TASK-026 — Customer Profile

Status: NOT STARTED

Phase: 3 ([[Phase 03 Customers]])

## Objective

Provide the customer profile operational view.

## Source Documents

- [[Customers]]
- [[Screen Inventory]]

## Dependencies

[[TASK-024 Customer List and Form UI]], [[TASK-025 Customer Company Relationships]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Identity, placeholders for invoices/payments, notes slot, activity slot. Currency-aware values; do not add mixed currencies without conversion.

### Excluded

Inventing converted totals without stored snapshots.

## Database Changes

Read models as needed.

## Backend

Profile summary endpoint.

## Frontend

Customer Profile screen.

## Authorization

Assigned company scope only.

## Business Rules

BR-013.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Profile payload.

### Authorization

Unassigned company data omitted.

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

[[TASK-027 Customer Notes]]
