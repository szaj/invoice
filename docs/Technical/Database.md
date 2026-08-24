---
type: technical
status: approved
tags:
  - technical
  - database
---

# Database

Prisma + Supabase PostgreSQL. Identity, RBAC, user management, and company identity tables exist; remaining product tables are added by later domain tasks. See [[05 Architecture Decisions#ADR-002 — Database|ADR-002]] and [[Data Model]].

## Local setup

1. Copy `.env.example` to `.env` (Prisma CLI) and `.env.local` (Next.js).
2. In the Supabase project, copy the database URLs from **Project Settings → Database**.
3. Set:

| Variable | Use |
| --- | --- |
| `DATABASE_URL` | Application runtime. Prefer the Supavisor **transaction pooler** (port `6543`) with `pgbouncer=true`. |
| `DIRECT_URL` | Prisma CLI: `migrate`, `studio`, introspection. Direct Postgres (port `5432`). |

Never prefix these with `NEXT_PUBLIC_`. They are server-only.

If you are not using a pooler, set both variables to the same direct URL.

4. Generate the client and apply foundation migrations:

```text
pnpm prisma:generate
pnpm prisma:migrate:dev
```

`prisma generate` can run without a live database. `migrate` fails closed if Postgres is unreachable.

## Connection split

```text
Next.js server  →  DATABASE_URL (pooled)  →  PrismaPg adapter  →  PostgreSQL
Prisma CLI      →  DIRECT_URL (direct)    →  prisma.config.ts  →  PostgreSQL
```

Do not run migrations through the transaction pooler. That can hang or break migration transactions.

## Migration workflow

| Script | Purpose |
| --- | --- |
| `pnpm prisma:generate` | Generate the server Prisma Client into `src/generated/prisma` |
| `pnpm prisma:validate` | Validate `prisma/schema.prisma` |
| `pnpm prisma:migrate:dev` | Create/apply migrations in local/dev |
| `pnpm prisma:migrate:deploy` | Apply existing migrations (staging/production) |
| `pnpm prisma:migrate:status` | Show pending/applied migrations |
| `pnpm prisma:studio` | Browse data (uses `DIRECT_URL`) |
| `pnpm bootstrap:admin -- --email <user@example.com>` | One-time/recovery assign of system ADMIN to an existing linked ACTIVE application user (application DB only; see [[Authentication]]) |

Do **not** use `prisma db push` as the production migration strategy.

Do **not** add `migrate reset` to package scripts. Resets are destructive and must be explicit.

The foundation migration only enables `pgcrypto` for later UUIDs.

TASK-003 adds `users` for identity mapping (`id`, `name`, `email`, `supabase_auth_user_id`, `status`, `last_login_at`). TASK-004 adds `password_reset_required` (workflow flag only). TASK-005 adds `roles`, `permissions`, `role_permissions`, and optional `users.role_id`. TASK-006 adds `employee_id`, `mfa_enabled`, and `created_by_user_id`. TASK-007 adds `companies` (identity, structured address, ISO country, contact, registration/tax number, Active/Inactive). TASK-008 adds `user_companies` (`user_id`, `company_id`). TASK-009 stores selected company context in an httpOnly cookie (`app-company-context`), not a database table. TASK-010 adds company branding columns on `companies` (`invoice_prefix`, `terms_and_conditions`, `email_template_reference`, logo metadata); logo bytes remain in object storage via StorageService. TASK-011 adds `company_groups` and optional `companies.reporting_group_id` for reporting roll-ups only (not authorization). TASK-012 adds append-only `audit_logs` (UTC `occurred_at`, actor type/user id, company id, entity, action, masked old/new JSON, reason, IP, user agent, correlation id). Actor/company IDs are historical references without FKs. TASK-013 adds `system_settings` (reporting currency code, default timezone, rounding tolerance placeholder) and Admin-only `settings.manage`. TASK-014 adds `currencies` (global catalog with seeded USD, AED, PKR, GBP, AUD; Admin add/disable under `currency.manage`). TASK-015 adds `company_currencies` (per-company enabled subset + default invoice currency under `company.write`). TASK-016 adds `fixed_conversion_rates` (Admin-defined fixed rates; `NUMERIC(20, 12)`; create-only; no live FX). TASK-017 makes versions append-only: creating a new version expires prior ACTIVE rows for the pair (retained permanently; `fixed_rate` not rewritten). TASK-018 reads those versions as an effective-rate read model (`valid_from`/`valid_to` windows). TASK-020 adds `payment_gateway_configs` and `payment_gateway_settlement_currencies` (method enablement + settlement currency codes; no encrypted credentials).  TASK-052 registers StripePaymentAdapter without schema changes (reuses method_code STRIPE; no Stripe-specific columns on payments). TASK-053 adds `payment_events` (unique `(method_code, external_event_id)`; optional `payment_id`; processing status; no secrets/raw card data). TASK-054 registers PayPalPaymentAdapter without schema changes (reuses method_code PAYPAL; no PayPal-specific columns on payments). TASK-055 reuses `payment_events` for PayPal webhook idempotency (no new migration). TASK-021 uses existing `currencies.status` flags only (no new tables): new-document selection rejects INACTIVE; historical display resolves INACTIVE without rewriting codes. TASK-022 adds `customers` master (Customers §7.1; email optional; soft ACTIVE/INACTIVE; optional default company preference). TASK-025 adds `customer_companies` (`customer_id`, `company_id`; backfill from existing `default_company_id`). TASK-027 adds `customer_notes` (internal-only; author + timestamp). TASK-030 adds `invoices` header (company+customer required; dates; currency code; draft status; compliance placeholder; nullable invoice_number; no line items/totals/payments). TASK-033 adds `invoice_items`. TASK-034 adds stored total columns on `invoices`. TASK-035 adds `companies.invoice_sequence_next` and `system_settings.invoice_number_include_year` (allocation uses branding `invoice_prefix`; unique `(company_id, invoice_number)` from TASK-030). TASK-037 adds `invoice_versions` (immutable JSON snapshots on issue). TASK-038 adds soft-cancel columns on `invoices` (`cancellation_reason`, `cancelled_at`, `cancelled_by_user_id`; no hard delete). TASK-039 adds `invoice_files` (PDF metadata; binaries in StorageService / R2). TASK-041 adds `email_logs` (invoice email delivery status, provider message id, sent_by; PDF bytes remain in object storage). TASK-044 adds `payments` (provider-agnostic payment records per Payments §10.3 / ADR-008; Decimal amounts/rates; optional fee/actual received; no credentials/charges/webhooks). TASK-046 adds `payments.rate_effective_at` (Admin rate-version effective timestamp; payment date when same-currency; locked on confirm). TASK-047 uses the existing optional `processor_fee_amount` and `actual_received_amount` columns (no new migration); they remain reconciliation-only and are excluded from conversion and outstanding. TASK-048 resolves PaymentProvider adapters against the existing `payment_gateway_configs` shape (company + method_code + enabled; credentials via TASK-049). Login does not assign a role. Payment charging remains later. Login credentials and recovery tokens remain in Supabase Auth. See [[Authentication]], [[Authorization]], [[Audit Logs]], [[Settings]], [[Currency and Conversion]], [[Customers]], [[Invoices]], and [[Payments]].

## Conventions for later tables

- Primary keys: UUID, `gen_random_uuid()`, `@db.Uuid`
- Transactional tables: `company_id` UUID (authorization remains application-owned)
- Timestamps: `created_at` / `updated_at` as `timestamptz` (UTC)
- Money: `Decimal` → PostgreSQL `NUMERIC(19, 4)` — never `Float`
- Conversion rates: `NUMERIC(20, 12)`

See `src/server/db/conventions.ts` and comments in `prisma/schema.prisma`.

## Server-only access

Import `getPrisma()` only from server code (`src/server/db/client.ts`). UI components must not query Prisma.

```text
Application / Domain
        ↓
src/server/db (and later repositories)
        ↓
Prisma Client
        ↓
Supabase PostgreSQL
```

## Tests

- Unit tests cover env validation, schema conventions, and fail-closed access without credentials. They do **not** load `.env` / `.env.local`.
- Live connectivity uses a dedicated Vitest config that loads `.env`, then `.env.local`, then keeps already-supplied process environment:

```text
$env:RUN_DB_INTEGRATION="true"
pnpm test:integration
```

That command tests application runtime access through `DATABASE_URL` after migrations are applied. Do not run it as part of `pnpm test`.

Live Supabase Auth login is a separate gated suite (`RUN_AUTH_INTEGRATION=true` plus `AUTH_TEST_EMAIL` / `AUTH_TEST_PASSWORD`). Do not mark those tests passed when credentials are absent.

## Related

- [[Data Model]]
- [[Security]]
- [[Authentication]]
- [[Deployment]]
- [[TASK-002 Database Foundation]]
