---
type: task
status: complete
phase: 3
module: customers
depends_on:
  - TASK-024
  - TASK-025
tags:
  - task
---

# TASK-026 — Customer Profile

Status: COMPLETE

Phase: 3 ([[Phase 03 Customers]])

## Objective

Provide the customer profile operational view.

## Source Documents

- [[Customers]]
- [[Screen Inventory]]

## Dependencies

[[TASK-024 Customer List and Form UI]], [[TASK-025 Customer Company Relationships]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Identity, placeholders for invoices/payments, notes slot, activity slot. Currency-aware values; do not add mixed currencies without conversion.

### Excluded

Inventing converted totals without stored snapshots.

## Database Changes

Read models as needed.

## Backend

Profile summary endpoint.

## Frontend

Customer Profile screen.

## Authorization

Assigned company scope only.

## Business Rules

BR-013.

## Error Handling

N/A

## Tests

### Unit

N/A

### Integration

Profile payload.

### Authorization

Unassigned company data omitted.

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
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/domain/customers/profile.ts` — profile DTO + placeholder messages (BR-013)
- `src/server/customers/customer-profile-service.ts` — profile summary; authorized company filter
- `src/app/api/customers/[id]/profile/route.ts` — GET profile (`companyId` query)
- `src/app/(app)/customers/[id]/customer-profile-company-filter.tsx`
- `tests/unit/customers-profile.test.ts`
- `tests/integration/customers-profile.test.ts`

### Files Modified

- `src/app/(app)/customers/[id]/page.tsx` — profile screen (identity + slots + activity)
- `src/server/customers/actions.ts` — `loadCustomerProfileForUi`
- `src/server/audit/audit-repository.ts` — entity-scoped `listByEntity` for activity
- `src/domain/customers/schema.ts` — `customerProfileQuerySchema`
- [[Customers]], [[API and Integrations]], [[Authorization]], [[Testing]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 03 Customers]], [[06 Development Log]]

### Migrations

None (application read model only).

### APIs

`GET /api/customers/{id}/profile?companyId=` — `customer.edit` + customer access; Staff/Compliance see only authorized linked companies; unauthorized company filter → 403.

### Tests

Unit: authorized company omission; Staff denied unauthorized filter; placeholders. Integration: profile payload + Staff omission/403. `pnpm typecheck` / `lint` / `format:check` / `test` (201) / `RUN_DB_INTEGRATION=true test:integration` (41 passed, 4 skipped) / `build` pass. E2E N/A.

### Issues

None. Live financial totals remain TASK-029. Threaded notes remain TASK-027. ADR-011 remains OPEN.

### Commit

Uncommitted (agent did not create a commit).

## Next Recommended Task

[[TASK-027 Customer Notes]]
