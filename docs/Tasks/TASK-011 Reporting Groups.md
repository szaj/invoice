---
type: task
status: not-started
phase: 1
module: companies
depends_on:
  - TASK-007
tags:
  - task
---

# TASK-011 — Reporting Groups

Status: NOT STARTED

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Optional parent reporting groups for roll-up reporting without weakening company access.

## Source Documents

- [[Companies and Brands]]
- [[Dashboard and Reporting]]
- [[Settings]]
- [[Data Model]]

## Dependencies

[[TASK-007 Company CRUD]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

company_groups; assign companies. VX is an example, not required seed data.

### Excluded

Monthly brand matrix report. Using group membership as authorization.

## Database Changes

company_groups; companies reporting_group_id / parent group.

## Backend

CRUD for reporting groups; assign brands.

## Frontend

Settings: Reporting Groups.

## Authorization

Group membership never bypasses company assignment.

## Business Rules

Historical ownership remains the original company/brand.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Group assignment persistence.

### Authorization

Staff cannot gain extra company access via a group.

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

[[TASK-012 Audit Event Foundation]]
