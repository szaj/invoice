---
type: task
status: not-started
phase: 5
module: payments
depends_on:
  - TASK-007
  - TASK-020
  - TASK-012
  - TASK-048
tags:
  - task
---

# TASK-049 — Gateway Configuration Per Company

Status: NOT STARTED

Phase: 5 ([[Phase 05 Payments]])

## Objective

Store encrypted, company-isolated gateway configuration.

## Source Documents

- [[Payments]]
- [[Security]]
- [[Settings]]
- [[Companies and Brands]]
- [[05 Architecture Decisions]]

## Dependencies

[[TASK-007 Company CRUD]], [[TASK-020 Settlement Currency Configuration]], [[TASK-012 Audit Event Foundation]], [[TASK-048 Payment Provider Abstraction]]

This task cannot start while a listed dependency is incomplete.

## Scope

### Included

Enabled flag, encrypted credentials, sandbox/live, settlement currencies, webhook configuration, provider-specific config isolated from core payment columns, status indicator. Never log secrets. Resolve adapters through the PaymentProvider registry.

### Excluded

Exposing secrets to Staff. Putting secrets in system_settings plaintext.

## Database Changes

payment_gateway_configs; encrypted secret references.

## Backend

Admin configuration APIs. Envelope/application-managed encryption.

## Frontend

Company Gateway Settings.

## Authorization

Admin yes; Compliance/Staff no for credentials.

## Business Rules

BR-008. Audit config changes without secret values.

## Error Handling

N/A

## Tests

### Unit

Secrets not present in log fixtures.

### Integration

Config CRUD without exposing secrets.

### Authorization

Staff cannot read credentials.

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

[[TASK-050 Manual Payment Recording]]
