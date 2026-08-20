---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-010
  - TASK-031
tags:
  - task
---

# TASK-035 — Invoice Numbering

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Generate invoice numbers using company prefix/sequence; unique within company; never reuse.

## Source Documents

- [[Invoices]]
- [[Companies and Brands]]
- [[Settings]]
- [[Business Rules]]

## Dependencies

[[TASK-010 Company Branding Configuration]], [[TASK-031 Invoice Draft Service]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Independent sequence per company; uniqueness; optional delay until issue if numbering is delayed until issue; optional year component from settings.

### Excluded

Global uniqueness across companies. Reusing cancelled numbers.

## Database Changes

Company sequence fields; unique constraint (company_id, invoice_number).

## Backend

Allocate number transactionally.

## Frontend

Read-only number display.

## Authorization

Users cannot hand-edit to a colliding number.

## Business Rules

BR-003.

## Error Handling

Collision rejected.

## Tests

### Unit

N/A

### Integration

Two concurrent issues cannot share a number in one company.

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

[[TASK-036 Invoice Lifecycle]]
