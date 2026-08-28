---
type: task
status: complete
phase: 9
module: ops
depends_on:
  - TASK-077
tags:
  - task
---

# TASK-098 — Performance Hardening

Status: COMPLETE

Phase: 9 ([[Phase 09 Hardening and Deployment]])

## Objective

Meet list pagination and page/API p95 guidance under normal load; reports remain usable.

## Source Documents

- [[Security]]
- [[Dashboard and Reporting]]

## Dependencies

[[TASK-077 Dashboard KPIs]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Server-side pagination/filtering/sorting; indexes; large reports as jobs if needed.

### Excluded

Loading unbounded lists.

## Database Changes

Indexes on company_id, customer_id, invoice number, status, dates, transaction IDs, report filters.

## Backend

Query/index work.

## Frontend

Responsive lists.

## Authorization

N/A

## Business Rules

p95 target under ~2 seconds for standard authenticated pages/API under normal load.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Basic performance checks on list/report endpoints.

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

- `src/domain/lists/pagination.ts`
- `src/components/data/list-pagination.tsx`
- `prisma/migrations/20260828100000_performance_list_indexes/migration.sql`
- `tests/unit/list-pagination.test.ts`
- `tests/integration/list-performance.test.ts`

### Files Modified

Invoice, customer, and payment list schemas, repositories, services, APIs, and UI pages; payment list no longer loads all invoices; vault current-state docs.

### Migrations

`20260828100000_performance_list_indexes` — invoice number / staff visibility / dates / transaction ID / report-filter indexes.

### APIs

`GET /api/invoices`, `GET /api/customers`, `GET /api/payments` return `{ rows via existing keys, totalCount, page, pageSize }` with pageSize clamped to 100.

### Tests

Unit: pagination clamp, search-param parse, bounded list services (payment list does not load all invoices). Integration: list/report page bounds and elapsed time under 2s (`RUN_DB_INTEGRATION=true`).

### Issues

Interactive lists never return more than 100 rows. Full report dumps remain TASK-090 export jobs. Browser UI not exercised (no browser tools in this session).

### Commit

Not committed (not requested).

## Next Recommended Task

[[TASK-099 Queue Hardening]]
