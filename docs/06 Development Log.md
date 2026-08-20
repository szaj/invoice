---
type: log
status: approved
tags:
  - architecture
---

# Development Log

Chronological implementation history. Do not fabricate completed work.

## Log Format

### YYYY-MM-DD — TASK-XXX

Work completed:

Files changed:

Database changes:

Tests:

Decisions:

Problems:

Next task:

## Entries

### 2026-08-20 — TASK-003 live verification

Work completed:

Live Supabase authentication verified against the configured project using the dedicated test account only. Valid login succeeded. Invalid password failed with the generic message. `getUser()` recognized the authenticated session. Logout cleared the Auth session. Application `users` identity mapping was created/updated by `supabase_auth_user_id` with no role, permission, or company columns. Authentication does not grant application authorization. No public signup. Logs recorded only safe events (`auth.login_failed` / `auth.login_succeeded` with application `userId`); no passwords or tokens.

Files changed:

Expanded the gated live Auth integration test. Clarified in [[Authentication]], [[Security]], and `LoginRateLimiter` comments that the current limiter is process-local in-memory and is not production distributed rate limiting (Redis later). Updated this log and [[TASK-003 Authentication Base]].

Database changes:

None. Existing identity mapping row updated on successful live login (`last_login_at`). No authorization fields added.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 41 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 6 passed (including live Auth). `pnpm build` pass. Playwright E2E still NOT RUN (browsers not installed; TASK-003 E2E is N/A).

Decisions:

Did not replace `MemoryLoginRateLimiter`. Documented that it is not globally effective across multiple containers.

Problems:

None.

Next task:

[[TASK-004 Password Reset and Session Controls]] (not started)

### 2026-08-20 — TASK-003

Work completed:

Implemented Supabase Auth login/logout identity foundation on Next.js App Router. Browser and server Supabase clients are separated. Server Components, Server Actions, Route Handlers, and `proxy.ts` establish identity with `getUser()`. Application `users` maps the Supabase Auth user ID only. Unauthenticated visitors cannot reach application routes. There is no public signup, no RBAC, and no company authorization. Login is rate-limited through an in-process `LoginRateLimiter` boundary. Password reset remains TASK-004.

Files changed:

Created `src/domain/auth/*`, `src/server/auth/*`, `src/lib/supabase/*`, `src/proxy.ts`, login/logout UI, `/api/auth/login` and `/api/auth/logout`, `docs/Technical/Authentication.md`, auth unit/integration tests. Updated env validation, Prisma schema, logger redaction, README, [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Security]], [[API and Integrations]], [[Database]], [[Phase 01 Foundation]], [[TASK-003 Authentication Base]].

Database changes:

Migration `20260820193000_authentication_base` creates `users` (identity mapping only). Applied with `pnpm prisma:migrate:deploy`. No roles, permissions, companies, invoices, or payments tables.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 41 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 5 passed, 1 skipped (live Supabase login; public Auth credentials unset). `pnpm build` pass (`/` and `/login` dynamic). Playwright E2E NOT RUN (browsers not installed). Live Auth E2E NOT RUN (no `AUTH_TEST_EMAIL` / `AUTH_TEST_PASSWORD`).

Decisions:

No new ADR. In-process login rate limiting is an implementation of the TASK-003 rate-limit boundary, replaceable later with Redis without changing login use cases. Auto-creating the application `users` row on first successful Auth login is identity linkage, not public signup or role assignment.

Problems:

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` were not set in this environment, so live Auth login was skipped rather than marked passed.

Next task:

[[TASK-004 Password Reset and Session Controls]] (not started)

### 2026-08-20 — TASK-002 verification

Work completed:

Fixed Vitest integration-test env loading. Prisma CLI already loaded `.env` / `.env.local`; Vitest did not, so `DATABASE_URL` was undefined and connectivity tests failed despite a working Supabase database and applied foundation migration. Added centralized `loadEnvFiles()` and a dedicated integration Vitest config. Unit tests still do not load developer database credentials.

Files changed:

`src/config/load-env-files.ts`, `tests/setup/integration-env.ts`, `vitest.integration.config.mts`, `vitest.config.mts`, `prisma.config.ts`, `package.json`, `docs/Technical/Database.md`, this log, [[TASK-002 Database Foundation]], [[04 Implementation Status]].

Database changes:

None in this verification pass. Foundation migration was already applied via `pnpm prisma:migrate:dev`.

Tests:

`pnpm prisma:generate` pass. `pnpm prisma:validate` pass. `pnpm typecheck` pass. `pnpm lint` pass. `pnpm test` 18 passed. `RUN_DB_INTEGRATION=true pnpm test:integration` 3 passed. `pnpm build` pass.

Decisions:

None. Runtime tests still use `DATABASE_URL`; CLI still uses `DIRECT_URL`.

Problems:

None remaining for TASK-002.

Next task:

[[TASK-003 Authentication Base]] (not started)

### 2026-08-20 — TASK-002

Work completed:

Established Prisma 7 against Supabase PostgreSQL: schema conventions (UUID, timestamptz, Decimal/NUMERIC, company_id on transactional tables), pooled `DATABASE_URL` vs direct `DIRECT_URL`, server-only Prisma client, foundation migration enabling `pgcrypto` only. No users/companies/invoices/payments tables.

Files changed:

Created `prisma/`, `prisma.config.ts`, `src/server/db/*`, `docs/Technical/Database.md`, DB unit/integration tests. Updated env validation, `.env.example`, CI, README, [[00 Home]], [[04 Implementation Status]], [[TASK-002 Database Foundation]], [[Phase 01 Foundation]], [[03 Implementation Plan]], ADR-002 consequences.

Database changes:

Foundation migration file only. Not applied (no reachable Postgres). `prisma migrate status` failed closed (P1001).

Tests:

`pnpm typecheck`, `pnpm lint`, `pnpm test` (16 passed, 3 integration skipped), `pnpm build`, `pnpm prisma generate`, `pnpm prisma validate`. Live connectivity not run (`RUN_DB_INTEGRATION` unset).

Decisions:

No new ADR. Documented Prisma 7 CLI vs runtime URL split under ADR-002.

Problems:

No local/Supabase credentials in this environment. Integration tests skipped rather than marked passed.

Next task:

[[TASK-003 Authentication Base]]

### 2026-08-20 — TASK-001

Work completed:

Established the Next.js App Router + TypeScript + pnpm repository foundation. Added centralized Zod environment configuration with required-now vs optional future secrets, UTC timestamp helpers, Pino logger, ESLint/Prettier, Vitest smoke tests, Playwright config, GitHub Actions CI placeholder, Tailwind/shadcn foundation, and a non-functional application shell. No product modules, Prisma schema, authentication, payments, or Docker compose.

Files changed:

Created application skeleton under the repository root (`package.json`, `src/`, `tests/`, `.github/workflows/ci.yml`, `.env.example`). Updated this log, [[00 Home]], [[04 Implementation Status]], [[TASK-001 Repository Foundation]], [[Phase 01 Foundation]], and [[03 Implementation Plan]].

Database changes:

None.

Tests:

`pnpm typecheck`, `pnpm lint`, `pnpm test` (7 passing), `pnpm build`. Playwright E2E not run (N/A for TASK-001; browsers not installed).

Decisions:

No new ADR. Existing ADRs 001, 012, 014, 016, 018, 019, 020, 021 were followed. Optional provider secrets do not fail local/CI startup. Docker/Caddy remain deferred to later deployment tasks.

Problems:

pnpm was not on PATH initially; installed via npm. Native `unrs-resolver` postinstall requires `allowBuilds` in `pnpm-workspace.yaml` (pnpm 11). Git was not initialized; commit was prepared but not created.

Next task:

[[TASK-002 Database Foundation]]

## Related

- [[04 Implementation Status]]
- [[03 Implementation Plan]]
- [[05 Architecture Decisions]]
- [[00 Home]]
