---
type: task
status: complete
phase: 3
module: customers
depends_on:
  - TASK-026
tags:
  - task
---

# TASK-029 — Customer Financial Summary

Status: COMPLETE

Phase: 3 ([[Phase 03 Customers]])

## Objective

Show Total Invoiced, Total Paid, Outstanding, Overdue in a currency-aware way.

## Source Documents

- [[Customers]]
- [[Dashboard and Reporting]]
- [[Definitions]]

## Dependencies

[[TASK-026 Customer Profile]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Summary widgets structured so mixed currencies are never naively summed. Live numbers wire as invoices/payments exist.

### Excluded

Converted totals without stored snapshots.

## Database Changes

Read aggregates only. No schema changes (invoice/payment tables do not exist yet).

## Backend

Profile summary/invoices/payments endpoints.

## Frontend

Financial Summary on profile.

## Authorization

Assigned scope.

## Business Rules

BR-013. Outstanding is invoice total minus confirmed payments in invoice currency.

## Error Handling

N/A

## Tests

### Unit

Warning conditions → Single-currency math; mixed-currency display rule.

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
- [x] [[04 Implementation Status]] updated
- [x] [[05 Architecture Decisions]] updated if required

## Cursor Implementation Result

### Files Created

- `src/domain/customers/financial-summary.ts`
- `src/server/customers/customer-financial-summary-source.ts`
- `src/server/customers/customer-financial-summary-service.ts`
- `src/app/api/customers/[id]/financial-summary/route.ts`
- `src/app/api/customers/[id]/invoices/route.ts`
- `src/app/api/customers/[id]/payments/route.ts`
- `src/app/(app)/customers/[id]/customer-financial-summary-panel.tsx`
- `tests/unit/customers-financial-summary.test.ts`

### Files Modified

- `src/domain/customers/profile.ts` — empty/ready financial summary types
- `src/domain/customers/access.ts` — `authorizedCustomerCompanyIds`
- `src/server/customers/customer-profile-service.ts` — wires summary source
- Profile UI page
- Vault: Customers, API, Authorization, Testing, Home, Status, Plan, Phase 03, Dev Log

### Migrations

None.

### APIs

- `GET /api/customers/{id}/financial-summary?companyId=`
- `GET /api/customers/{id}/invoices?companyId=` (placeholder items until TASK-030+)
- `GET /api/customers/{id}/payments?companyId=` (placeholder items until payments)
- Profile `financialSummary` is currency-bucketed; `sourceAvailable: false` / `status: empty` until invoice source is wired

### Tests

Unit: single-currency aggregation (invoiced/paid/outstanding/overdue); mixed-currency separate buckets; no unlabeled grand total; company filter / cancelled exclusion.

### Issues

Live amounts remain empty until invoice/payment modules exist. Source adapter is `EmptyCustomerFinancialSummarySource` (`available: false`). No reporting-currency conversion (excluded without stored snapshots).

### Commit

Uncommitted (await explicit commit request).

## Next Recommended Task

[[TASK-030 Invoice Domain Schema]]
