---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-031
  - TASK-039
tags:
  - task
---

# TASK-043 — Invoice Duplicate and Print

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Duplicate creates a new Draft with copied line items and new ID/number rules. Print via stored PDF.

## Source Documents

- [[Invoices]]

## Dependencies

[[TASK-031 Invoice Draft Service]], [[TASK-039 PDF Generation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Duplicate action; download PDF / print.

### Excluded

Copying invoice numbers. Changing historical PDFs. Copying payments.

## Database Changes

New invoice row.

## Backend

duplicate action.

## Frontend

Duplicate and export/print actions.

## Authorization

Same as create invoice.

## Business Rules

New draft; numbering rules still apply.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Duplicate is Draft with a new number/id.

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

[[TASK-044 Payment Domain Schema]]
