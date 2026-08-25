---
type: task
status: complete
phase: 5
module: payments
depends_on:
  - TASK-045
  - TASK-046
  - TASK-018
tags:
  - task
---

# TASK-050 — Manual Payment Recording

Status: COMPLETE

Phase: 5 ([[Phase 05 Payments]])

## Objective

Authorized users record payments received outside an automated gateway.

## Source Documents

- [[Payments]]
- [[Currency and Conversion]]
- [[Roles and Permissions]]
- [[Error Handling]]

## Dependencies

[[TASK-045 Payment Service]], [[TASK-046 Settlement Conversion Snapshot]], [[TASK-018 Effective Rate Selection]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Amount applied, settlement currency, method, reference, date, notes; apply configured fixed rate; optional merchant fee reconciliation only; immutable on confirm; audit event.

### Excluded

Optimistic Paid on gateway timeout. Editing confirmed payments. Fake webhook behavior for manual payments.

## Database Changes

payments rows for manual method.

## Backend

ManualPaymentAdapter / domain path: company authorization, invoice validation, amount validation, Admin fixed-rate snapshot when cross-currency, immutable confirmation, audit. Same core payment domain as gateway payments. No fake webhooks.

## Frontend

None (UI is TASK-051).

## Authorization

Admin/Compliance yes; Staff optional permission (US-007) — do not silently grant it.

## Business Rules

BR-006, BR-010, BR-020.

## Error Handling

Missing rate blocks cross-currency payment.

## Tests

### Unit

Conversion uses Admin rate.

### Integration

Manual confirm locks snapshot.

### Authorization

Staff denied unless optional permission is explicitly configured.

### E2E

E2E-05 precursor.

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

- `src/domain/payments/manual.ts` — BR-010 open-balance guard (fee excluded)
- `src/app/api/payments/manual/route.ts` — POST manual record endpoint
- `tests/unit/payments-manual.test.ts`
- `tests/integration/payments-manual.test.ts`

### Files Modified

- `src/domain/payments/{schema,types}.ts` — `paymentManualRecordSchema`; open-balance / misconfig errors
- `src/server/payments/payment-service.ts` — `recordManualPayment` (create PENDING → confirm SUCCESSFUL)
- Unit payment service/schema tests
- Vault: Payments, API, Authorization, Testing, Error Handling, Unresolved Source Items, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

None. Reuses TASK-044 `payments` table (`method_code=MANUAL`).

### APIs

- `POST /api/payments/manual` — record manual payment: forces `methodCode=MANUAL` + `source=MANUAL`; derives company/customer from invoice; concrete company context; Admin fixed-rate snapshot; optional fee/actual received reconciliation-only; create PENDING then confirm SUCCESSFUL via existing lifecycle; no fake gateway transaction IDs; no invoice paid/outstanding mutation (TASK-060)
- Reuses existing GET list/detail and create-pending/confirm/fail

### Tests

- Unit: Admin rate conversion; same-currency rate 1; missing rate blocks; BR-010 over-balance reject (fee ignored); Staff denied (US-007); schema rejects method/company/rate smuggling
- Integration: AUD→AED manual record locks snapshot; Staff 403; invoice outstanding unchanged; audit created+confirmed (E2E-05 precursor)
- `pnpm typecheck` / `lint` / `format:check` / `test` (325) / payment integration tests pass / full `RUN_DB_INTEGRATION=true test:integration` 58 pass / 4 skipped / 1 unrelated customers-crud flake / `build` pass
- E2E UI N/A (TASK-051)

### Issues

US-007 remains OPEN with default deny (Staff not granted). US-015 overpayment *allow* workflow remains OPEN (TASK-059/060); TASK-050 rejects applied > open balance without inventing an allow path. Invoice paid/outstanding allocation remains TASK-060. ADR-009 / ADR-010 / ADR-011 remain OPEN. Manual Payment UI is TASK-051.

Post-complete test infra: `customers-crud` unique-constraint flake was shared fixture-ID contamination from early TASK-050 `payments-manual` IDs (`…ee50`/`…ee52` vs customers-crud `…ee51`/`…ee52`). Remapped payment fixture IDs and cleared leftover users; no application defect. TASK-050 remains COMPLETE.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-051 Manual Payment UI]]
