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

# TASK-010 — Company Branding Configuration

Status: NOT STARTED

Phase: 1 ([[Phase 01 Foundation]])

## Objective

Store brand identity later used by invoices, PDFs, and email.

## Source Documents

- [[Companies and Brands]]
- [[Settings]]
- [[PDF and Email]]
- [[Security]]

## Dependencies

[[TASK-007 Company CRUD]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Logo upload metadata with MIME/size validation; invoice prefix; terms; email template reference; contact details from section 5.1.

### Excluded

PDF rendering. Sending email. Sequence issuance.

## Database Changes

Company branding fields; logo file metadata.

## Backend

Company branding subresource.

## Frontend

Invoice Branding on company screens.

## Authorization

Admin only. Staff cannot edit company branding.

## Business Rules

Prefix is company-specific (e.g. VX-).

## Error Handling

Reject invalid uploads.

## Tests

### Unit

N/A

### Integration

Upload validation.

### Authorization

Staff cannot change branding.

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

[[TASK-011 Reporting Groups]]
