---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-022
  - TASK-015
  - TASK-009
tags:
  - task
---

# TASK-030 — Invoice Domain Schema

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Create the invoice header schema for a concrete company and customer.

## Source Documents

- [[Invoices]]
- [[Data Model]]
- [[Business Rules]]

## Dependencies

[[TASK-022 Customer Domain Schema]], [[TASK-015 Company Currency Configuration]], [[TASK-009 Tenant Isolation and Company Context]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

invoices fields: company, customer, dates, currency, reference/PO, assigned staff, compliance status placeholder, internal notes, customer notes.

### Excluded

Issuing, numbering lock, PDF, payments.

## Database Changes

invoices.

## Backend

Persistence model.

## Frontend

None required.

## Authorization

Transactional action requires one company.

## Business Rules

BR-001, BR-002.

## Error Handling

N/A

## Tests

### Unit

Company+customer required at schema/validation layer.

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

[[TASK-031 Invoice Draft Service]]
