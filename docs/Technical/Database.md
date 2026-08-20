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

TASK-003 adds `users` for identity mapping (`id`, `name`, `email`, `supabase_auth_user_id`, `status`, `last_login_at`). TASK-004 adds `password_reset_required` (workflow flag only). TASK-005 adds `roles`, `permissions`, `role_permissions`, and optional `users.role_id`. TASK-006 adds `employee_id`, `mfa_enabled`, and `created_by_user_id`. TASK-007 adds `companies` (identity, structured address, ISO country, contact, registration/tax number, Active/Inactive). TASK-008 adds `user_companies` (`user_id`, `company_id`). TASK-009 stores selected company context in an httpOnly cookie (`app-company-context`), not a database table. TASK-010 adds company branding columns on `companies` (`invoice_prefix`, `terms_and_conditions`, `email_template_reference`, logo metadata); logo bytes remain in object storage via StorageService. TASK-011 adds `company_groups` and optional `companies.reporting_group_id` for reporting roll-ups only (not authorization). TASK-012 adds append-only `audit_logs` (UTC `occurred_at`, actor type/user id, company id, entity, action, masked old/new JSON, reason, IP, user agent, correlation id). Actor/company IDs are historical references without FKs. Login does not assign a role. None of these tasks add customers, invoices, payments, currencies, or invoice sequence. Login credentials and recovery tokens remain in Supabase Auth. See [[Authentication]], [[Authorization]], and [[Audit Logs]].

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
