---
type: task
status: complete
phase: 7
module: compliance
depends_on:
  - TASK-030
  - TASK-044
tags:
  - task
---

# TASK-071 — Compliance Status Model

Status: COMPLETE

Phase: 7 ([[Phase 07 Compliance and Audit]])

## Objective

Add compliance statuses Not Reviewed, Under Review, Approved, Flagged on relevant records.

## Source Documents

- [[Compliance]]
- [[Invoices]]
- [[Data Model]]

## Dependencies

[[TASK-030 Invoice Domain Schema]], [[TASK-044 Payment Domain Schema]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Status fields on invoice/payment/customer as specified for review. Start compliance_reviews entity.

### Excluded

Letting Staff change compliance status.

## Database Changes

compliance status fields; compliance_reviews.

## Backend

Status on records.

## Frontend

Status display.

## Authorization

Compliance review: Admin and Compliance yes; Staff no.

## Business Rules

No audit log deletion.

## Error Handling

Staff 403 on status change.

## Tests

### Unit

N/A

### Integration

Status updates.

### Authorization

Staff cannot set compliance status.

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

- `prisma/migrations/20260825210000_compliance_status_model/migration.sql`
- `src/domain/compliance/types.ts`
- `src/domain/compliance/schema.ts`
- `src/server/compliance/compliance-repository.ts`
- `src/server/compliance/compliance-service.ts`
- `src/app/api/compliance/status/route.ts`
- `tests/unit/compliance-status.test.ts`
- `tests/integration/compliance-status.test.ts`

### Files Modified

- `prisma/schema.prisma` — shared `ComplianceStatus`; columns on customers/payments; `compliance_reviews`
- Invoice draft/issued metadata no longer accept compliance status writes
- Customer/payment/invoice detail pages display compliance status
- Domain records, repositories, audit actions, StatusBadge tones

### Migrations

`20260825210000_compliance_status_model` — rename enum to `compliance_status`; add customer/payment columns; create `compliance_reviews`

### APIs

`POST /api/compliance/status` — body `{ subjectType, subjectId, status, companyId? }`; requires `compliance.review`

### Tests

Unit: Staff 403; Admin/Compliance status update + review row. Integration: DB status updates (RUN_DB_INTEGRATION).

### Issues

None. Notes/reason codes and review queue UI remain TASK-072/073/074.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-072 Compliance Review Queue]]
