---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-078
tags:
  - task
---

# TASK-090 — Report Exports

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

CSV for all tabular reports; XLSX recommended; PDF optional for summaries; export audited.

## Source Documents

- [[Dashboard and Reporting]]
- [[Audit Logs]]
- [[Security]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-078 Invoice Report]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Preserve selected filters and totals. Large reports run as **BullMQ** jobs so the UI stays responsive ([[05 Architecture Decisions#ADR-005 — Background jobs|ADR-005]]). Export files through StorageService when applicable. TanStack Table must not load the full financial dataset into the browser.

### Excluded

Exporting without audit. Unscoped exports.

## Database Changes

Export file metadata.

## Backend

Export jobs/files endpoints.

## Frontend

Export actions on reports.

## Authorization

Admin yes; Compliance yes; Staff optional (US-009) default no until decided.

## Business Rules

Export action logged. BR-015.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Export is audited and scoped.

### Authorization

Staff denied by default.

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

[[TASK-091 Operational Notifications]]
