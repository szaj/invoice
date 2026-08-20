---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-039
tags:
  - task
---

# TASK-040 — PDF Preview and Download

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Preview and download the stored invoice PDF.

## Source Documents

- [[PDF and Email]]
- [[Screen Inventory]]
- [[Invoices]]

## Dependencies

[[TASK-039 PDF Generation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

PDF preview/download from invoice view. Historical versions retrievable if revised.

### Excluded

Mutating historical PDF bytes.

## Database Changes

None.

## Backend

Authorized download by invoice/file id.

## Frontend

PDF Preview / Export/Print.

## Authorization

Same as invoice access.

## Business Rules

N/A

## Error Handling

Unauthorized download 403.

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Staff cannot download unassigned invoice PDF.

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

[[TASK-041 Email Delivery]]
