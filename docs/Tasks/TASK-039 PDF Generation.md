---
type: task
status: not-started
phase: 4
module: invoicing
depends_on:
  - TASK-036
  - TASK-010
  - TASK-033
  - TASK-034
tags:
  - task
---

# TASK-039 — PDF Generation

Status: NOT STARTED

Phase: 4 ([[Phase 04 Invoicing]])

## Objective

Generate branded server-side PDFs with **React-pdf** and store them as versioned documents through **StorageService** (Cloudflare R2 / S3-compatible).

## Source Documents

- [[PDF and Email]]
- [[Invoices]]
- [[Data Model]]
- [[Error Handling]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-036 Invoice Lifecycle]], [[TASK-010 Company Branding Configuration]], [[TASK-033 Invoice Line Items]], [[TASK-034 Invoice Totals]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Logo, legal/display info, number, dates, billing details, lines, totals, paid, balance, currency, terms, A4/Letter, checksum. Internal notes never printed. Immutable historical PDF; do not regenerate an old invoice from today’s mutable data when a stored version exists. Queueable via BullMQ when generation should not block HTTP ([[05 Architecture Decisions#ADR-005 — Background jobs|ADR-005]]).

### Excluded

Email send. Claiming email sent if PDF failed. Calling Cloudflare-specific APIs from invoice domain code when StorageService is sufficient. Storing large PDF binaries in ordinary PostgreSQL columns.

## Database Changes

invoice_files metadata in PostgreSQL. Blob in R2 via StorageService.

## Backend

React-pdf generation in domain/application service; store once per version through StorageService. Queueable via BullMQ.

## Frontend

None (preview UI is TASK-040).

## Authorization

Based on invoice access.

## Business Rules

Historical versions retrievable.

## Error Handling

Generation error does not claim success.

## Tests

### Unit

Internal notes absent from PDF bytes/text extract fixture.

### Integration

Generate stores a file row.

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

[[TASK-040 PDF Preview and Download]]
