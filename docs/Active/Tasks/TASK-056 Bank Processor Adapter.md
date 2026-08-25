---
type: task
status: deferred
phase: 5
module: payments
depends_on:
  - TASK-048
  - TASK-049
tags:
  - task
---

# TASK-056 — Bank Processor Adapter

Status: DEFERRED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Implement the generic bank/card processor adapter using the same PaymentProvider interface and capabilities. Exact processor brand is not mandated. Do not invent a required processor. Future named processors (including Authorize.Net) are additional adapters, not Version 1 scope.

## Source Documents

- [[Payments]]
- [[API and Integrations]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-048 Payment Provider Abstraction]], [[TASK-049 Gateway Configuration Per Company]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Standard internal interface; exact processor can be implemented as an integration. Do not invent a required processor brand.

### Excluded

A specific processor brand as if mandated. Card PAN/CVV storage.

## Database Changes

Gateway type for generic processor.

## Backend

Adapter implementation of the same interface except webhook if split.

## Frontend

Company enablement.

## Authorization

Admin credentials only.

## Business Rules

Same fee/conversion isolation rules.

## Error Handling

N/A

## Tests

### Unit

Interface-compliance tests.

### Integration

N/A

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
- [ ] [[03 Current Implementation Status]] updated
- [ ] [[05 Architecture Decisions]] updated if required

> DoD checkboxes remain unchecked. This task is **DEFERRED**, not COMPLETE. No live bank processor adapter was implemented.

## Deferral Decision (2026-08-24)

**Product/architecture decision:** Do not invent a fictional/generic banking API for Version 1.

- The `PaymentProvider` architecture remains the extension point for additional providers.
- Version 1 concrete live adapters: **MANUAL**, **STRIPE**, **PAYPAL**.
- `BANK_PROCESSOR` remains a provider **slot / configuration method code** on company gateway config (TASK-020 / TASK-049). No live `BankProcessorAdapter` is registered until a concrete vendor and API contract are selected.
- Do **not** create a Fake/Generic `BankProcessorAdapter` that pretends to process payments.
- Future named processors (Authorize.Net, Adyen, Checkout.com, Braintree, local acquirers, others) are added as independent `PaymentProvider` adapters + registry registration + tests — **without** redesigning the core payment domain (ADR-008).
- [[TASK-057 Bank Processor Webhook]] is deferred with this task (no adapter → no webhook pipeline).

Re-open when: concrete bank/card processor brand + API contract (create/status, credentials, sandbox/live, status mapping, capability flags) are accepted in the vault.

## Cursor Implementation Result

### Files Created

None (deferred; no invented adapter).

### Files Modified

Vault only: this task, [[TASK-057 Bank Processor Webhook]], [[04 Current Plan]], [[03 Current Implementation Status]], [[Phase 05 Payments]], [[Payments]], [[01 Current Architecture]], ADR-008 consequences, [[Unresolved Source Items]], [[06 Development Log]], [[00 Home]].

### Migrations

None.

### APIs

None.

### Tests

None for a live bank adapter (none implemented).

### Issues

Blocked on missing concrete vendor/API selection. Formal deferral recorded 2026-08-24. Do not invent a required processor.

### Commit

Not created (docs-only deferral; commit not requested).

## Next Recommended Task

[[TASK-058 Hosted Checkout]] (next buildable; does not depend on TASK-056/057)
