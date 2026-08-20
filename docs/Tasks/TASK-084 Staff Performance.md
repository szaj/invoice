---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-031
  - TASK-060
tags:
  - task
---

# TASK-084 — Staff Performance

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Invoices created/sent, value invoiced, collections linked to assigned invoices.

## Source Documents

- [[Dashboard and Reporting]]

## Dependencies

[[TASK-031 Invoice Draft Service]], [[TASK-060 Payment Allocation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Staff performance metrics as specified.

### Excluded

Implying staff commission unless separately defined.

## Database Changes

Queries.

## Backend

Staff performance endpoint.

## Frontend

Staff Performance report.

## Authorization

Limited for Staff as matrix.

## Business Rules

Do not invent commission.

## Error Handling

N/A

## Tests

### Unit

Commission is not calculated.

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

[[TASK-085 Gateway Report]]
