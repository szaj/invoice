---
type: task
status: complete
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

Status: COMPLETE

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

Encryption architecture dependency: [[05 Architecture Decisions#ADR-022 — Gateway credential encryption|ADR-022]] (ACCEPTED 2026-08-24). The prior encryption/key-management blocker is **cleared**. Implement credential storage against ADR-022; do not invent alternate crypto.

## Scope

### Included

Enabled flag, encrypted credentials, sandbox/live, settlement currencies, webhook configuration, provider-specific config isolated from core payment columns, status indicator. Never log secrets. Resolve adapters through the PaymentProvider registry. Follow ADR-022 envelope encryption (AES-256-GCM, versioned env KEK keyring, server-only decrypt boundary).

### Excluded

Exposing secrets to Staff. Putting secrets in system_settings plaintext. Resolving ADR-009 / ADR-010 / ADR-011. Live charging, webhooks, hosted checkout, allocation, or payment UI (later tasks).

## Database Changes

payment_gateway_configs; encrypted secret material and decrypt metadata per ADR-022 (ciphertext, nonces, auth tags, wrapped DEK, key/format versions). Never plaintext credentials. Never credentials on `payments`.

## Backend

Admin configuration APIs. Envelope/application-managed encryption via `GatewayCredentialService` → `CredentialCipher` → `KeyProvider` (`EnvironmentKeyProvider`). Explicit secret replace/rotation. Safe GET metadata only (`credentialsConfigured`).

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

Secrets not present in log fixtures. Cipher/envelope unit coverage when implemented. Env keyring validation fail-closed.

### Integration

Config CRUD without exposing secrets (no ciphertext/DEK/nonce/tag/plaintext in responses).

### Authorization

Staff cannot read credentials.

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

- `src/server/gateway-credentials/{key-provider,credential-cipher,gateway-credential-service}.ts`
- `src/domain/gateway-config/{types,schema}.ts`
- `src/server/gateway-config/{gateway-config-repository,gateway-config-service,actions}.ts`
- `src/app/api/companies/[id]/gateways/route.ts`
- `src/app/api/companies/[id]/gateways/[methodCode]/route.ts`
- `src/app/api/companies/[id]/gateways/[methodCode]/credentials/route.ts`
- `src/app/(app)/companies/[id]/gateways/{page,gateway-config-form}.tsx`
- `prisma/migrations/20260824270000_gateway_configuration_credentials/`
- `tests/unit/gateway-credentials.test.ts`
- `tests/integration/gateway-configuration.test.ts`

### Files Modified

- `prisma/schema.prisma` — `GatewayEnvironment`; envelope + environment + `provider_config` on `PaymentGatewayConfig`
- `src/config/{env-schema,env}.ts` — typed `GATEWAY_CREDENTIALS_KEY_*` keyring
- `src/domain/audit/{types,mask}.ts` — gateway audit actions; allow `credentialsConfigured` metadata
- `src/lib/logger.ts` — redact ciphertext/DEK/credential paths
- `src/components/data/status-badge.tsx` — HEALTHY / CONFIGURATION_ERROR / DISABLED
- Company detail + settlement copy links; PaymentProvider gateway config comment
- Vault: Payments, Settings, Companies and Brands, Data Model, Security, Authorization, API and Integrations, Database, Audit Logs, Testing, Home, Status, Plan, Phase 05, Dev Log, this task

### Migrations

`20260824270000_gateway_configuration_credentials` — extends TASK-020 `payment_gateway_configs` with sandbox/live, non-secret `provider_config`, and ADR-022 envelope columns. Applied with `pnpm prisma:migrate:deploy`. No competing config model. No credentials on `payments`. No live charges/webhooks.

### APIs

- `GET /api/companies/{id}/gateways` — safe metadata only (`credentialsConfigured`, status, environment, providerConfig, settlement codes)
- `PATCH /api/companies/{id}/gateways/{methodCode}` — non-secret updates; preserves credentials
- `PUT /api/companies/{id}/gateways/{methodCode}/credentials` — explicit credential replace (encrypted)
- Reuses TASK-020 settlement APIs for settlement currencies
- Decrypt only via server-only `GatewayCredentialService` (not from routes/RSC/audit)

### Tests

Unit: encrypt→decrypt; tamper/AAD fail-closed; keyring fail-closed; safe public view; audit mask; typed env. Integration: migration; encrypt persistence; Staff 403; company isolation; non-secret PATCH preserves ciphertext; explicit replace; audit/API leak regression; settlement reuse; key-version retained. `pnpm typecheck` / `lint` / `format:check` / `test` (314) / `RUN_DB_INTEGRATION=true test:integration` (58 passed, 4 skipped) / `build` pass. E2E N/A per task.

### Issues

Live Stripe/PayPal/bank adapters, webhook processing, hosted checkout, allocation, and payment UI remain later. Automatic KEK re-encrypt maintenance tooling deferred (version metadata retained). ADR-009 / ADR-010 / ADR-011 remain OPEN.

### Commit

Not created (not requested).

## Next Recommended Task

[[TASK-050 Manual Payment Recording]]
