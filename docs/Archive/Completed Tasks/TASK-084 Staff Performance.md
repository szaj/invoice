---
type: task
status: complete
phase: 8
module: reporting
depends_on:
  - TASK-031
  - TASK-060
tags:
  - task
---

# TASK-084 — Staff Performance

Status: COMPLETE

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

- [x] Required schema changes completed
- [x] Backend/domain implementation completed
- [x] UI completed where applicable
- [x] Server-side authorization enforced
- [x] Business rules enforced
- [x] Tests added
- [x] Relevant tests passing
- [x] Documentation updated
- [x] [[03 Current Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/domain/reporting/staff-performance.ts`
- `src/server/reporting/staff-performance-repository.ts`
- `src/server/reporting/staff-performance-service.ts`
- `src/app/api/reports/staff/route.ts`
- `src/app/(app)/reports/staff/page.tsx`
- `src/app/(app)/reports/staff/staff-performance-filters.tsx`
- `tests/unit/staff-performance.test.ts`

### Files Modified

- `src/domain/reporting/types.ts`
- `src/domain/reporting/schema.ts`
- `src/server/reporting/actions.ts`
- `src/components/layout/nav-config.ts`
- Active current-state docs (Architecture, Plan, Status, Home, Development Log, Dashboard and Reporting module, Phase 08 index)

### Migrations

None (query-only).

### APIs

- `GET /api/reports/staff` — Staff Performance (`report.view`)

### Tests

- `tests/unit/staff-performance.test.ts` — metrics, no commission, authz/nav/scope, filter parse

### Issues

None.

### Commit

Not created (agent does not commit unless asked).

## Next Recommended Task

[[TASK-085 Gateway Report]]
