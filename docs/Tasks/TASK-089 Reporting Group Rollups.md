---
type: task
status: not-started
phase: 8
module: reporting
depends_on:
  - TASK-088
  - TASK-011
tags:
  - task
---

# TASK-089 — Reporting Group Rollups

Status: NOT STARTED

Phase: 8 ([[Phase 08 Reporting]])

## Objective

Roll up the monthly matrix and KPIs by reporting group without changing transaction ownership.

## Source Documents

- [[Dashboard and Reporting]]
- [[Companies and Brands]]

## Dependencies

[[TASK-088 Monthly Brand Matrix]], [[TASK-011 Reporting Groups]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

One group, multiple groups, single brand, or All Companies. VX is an example, not required seed data.

### Excluded

Using group membership to authorize data access.

## Database Changes

Queries.

## Backend

Group filter on reports.

## Frontend

Reporting Group filter and summary blocks.

## Authorization

All Companies reporting still respects user assignment except Admin.

## Business Rules

Group does not weaken access controls.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

N/A

### Authorization

Staff cannot roll up unassigned companies via a group.

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

[[TASK-090 Report Exports]]
