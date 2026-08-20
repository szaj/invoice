---
type: task
status: complete
phase: 2
module: currency
depends_on:
  - TASK-014
  - TASK-007
tags:
  - task
---

# TASK-020 — Settlement Currency Configuration

Status: COMPLETE

Phase: 2 ([[Phase 02 Financial Foundation]])

## Objective

Configure settlement currencies separately per payment method/company. Initially USD and AED only unless expanded by Admin.

## Source Documents

- [[Currency and Conversion]]
- [[Payments]]
- [[Companies and Brands]]

## Dependencies

[[TASK-014 Currency Master]], [[TASK-007 Company CRUD]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Per-method settlement currency support flags. Initial USD and AED.

### Excluded

Gateway credential storage. Charging a customer.

## Database Changes

Supported settlement currencies on gateway config shape; credentials later.

## Backend

Configuration API without live charges.

## Frontend

Company payment-method settlement currency settings (enablement only).

## Authorization

Admin only.

## Business Rules

BR-006, BR-007.

## Error Handling

Reject a non-enabled settlement currency.

## Tests

### Unit

N/A (authorization/assert helpers covered in unit suite alongside schema).

### Integration

Enablement persistence.

### Authorization

Non-enabled settlement currency rejected.

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

`src/domain/settlement/{types,schema,assert-enabled}.ts`, `src/server/settlement/{settlement-repository,settlement-service,actions}.ts`, `src/app/api/companies/[id]/settlement/route.ts`, `src/app/api/companies/[id]/settlement/[methodCode]/route.ts`, `src/app/(app)/companies/[id]/settlement/{page,settlement-config-form}.tsx`, `prisma/migrations/20260820320000_settlement_currency_configuration/`, `tests/unit/settlement-currencies.test.ts`, `tests/integration/settlement-currencies.test.ts`.

### Files Modified

`prisma/schema.prisma` (`PaymentMethodCode`, `PaymentGatewayConfig`, `PaymentGatewaySettlementCurrency`), audit action/entity types, company detail link, company-currency form copy, companies-crud integration assertion, [[Currency and Conversion]], [[Payments]], [[Companies and Brands]], [[Data Model]], [[Security]], [[Authorization]], [[API and Integrations]], [[Database]], [[Settings]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 02 Financial Foundation]], [[06 Development Log]], [[TASK-020 Settlement Currency Configuration]].

### Migrations

`20260820320000_settlement_currency_configuration` — `payment_method_code` enum; `payment_gateway_configs` (company, method, enabled; no credentials); `payment_gateway_settlement_currencies` (per-method currency enablement). Applied with `pnpm prisma:migrate:deploy`. Encrypted credentials / sandbox / webhooks remain TASK-049. No live charges or payment allocation.

### APIs

- `GET /api/companies/{id}/settlement` — Admin `gateway.credentials.manage`
- `PATCH /api/companies/{id}/settlement/{methodCode}` — replace method enablement + enabled settlement currency codes
- Domain `assertSettlementCurrencyEnabled` / `validateSettlementCurrencyForMethod` for BR-006 (no charging)

### Tests

Unit: schema; assert enabled; Admin vs Staff; inactive global reject; BR-006 reject; persist + audit. Integration: migration recorded; enablement persistence; Staff denied; inactive reject; non-enabled settlement currency rejected; tables present. `pnpm typecheck` / `lint` / `format:check` / `test` (170) / `RUN_DB_INTEGRATION=true test:integration` (42 passed, 1 skipped) / `build` pass. E2E N/A.

### Issues

Credentials, live gateway processing, payment allocation, and invoice payment flows remain later. ADR-011 remains OPEN.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-021 Currency Disable and Historical Visibility]]
