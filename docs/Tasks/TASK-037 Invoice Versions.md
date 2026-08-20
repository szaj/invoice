---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-036
  - TASK-012
tags:
  - task
---

# TASK-037 — Invoice Versions

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Preserve version metadata for issued documents. Do not silently alter issued financial documents.

## Source Documents

- [[Invoices]]
- [[Data Model]]
- [[Audit Logs]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-036 Invoice Lifecycle]], [[TASK-012 Audit Event Foundation]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

invoice_versions; reason; created_by. Until [[05 Architecture Decisions#ADR-009 — Issued invoice financial edit policy|ADR-009]] is accepted, do not implement silent financial edits. Non-financial metadata may be edited with audit history.

### Excluded

Choosing cancel-and-reissue vs revision as if already accepted.

## Database Changes

invoice_versions.

## Backend

Version snapshot metadata on issue.

## Frontend

Version history on invoice view.

## Authorization

Edit issued: Controlled for Admin/Compliance; No for Staff.

## Business Rules

Issued documents not silently altered.

## Error Handling

Issued financial PATCH rejected.

## Tests

### Unit

N/A

### Integration

Issue creates a version.

### Authorization

Staff cannot PATCH issued financial fields.

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

[[TASK-038 Invoice Cancellation]]
