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

### 2026-08-20 — TASK-012

Work completed:

Implemented append-only `audit_logs` foundation and wired writers for login success/failure/logout, user create/update/suspend (role/company/status), and company create/update/status. Sensitive values are masked before persistence. UTC timestamps and correlation IDs are stored. Pino remains operational logging (ADR-014). No audit viewer UI/API. Actor/company IDs are historical references without FKs.

Files changed:

Created audit domain (types/mask/schema), append-only repository/service, unit/integration tests, migrations `20260820270000_audit_event_foundation` and `20260820270100_audit_event_no_fk`. Wired login/logout, user-service, company-service. Updated [[Security]], [[API and Integrations]], [[Database]], [[Audit Logs]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-014 consequences, [[TASK-012 Audit Event Foundation]].

Database changes:

Migrations add `audit_logs` and drop actor/company FKs. Applied with `pnpm prisma:migrate:deploy`. No viewer tables, currencies, invoices, or payments.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 131 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 32 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. ADR-014 consequences updated to separate Pino from `audit_logs`. Auth audit writes are best-effort so login availability does not depend on audit persistence; privileged Admin mutations require a successful audit write (BR-015). US-010 remains OPEN.

Problems:

None blocking. Audit viewer remains TASK-076. Later mandatory event categories (currency, invoice, payment, gateway, etc.) remain later tasks.

Next task:

[[TASK-013 Core System Settings]] (not started)

### 2026-08-20 — TASK-011

Work completed:

Implemented optional parent reporting groups for consolidated report roll-ups. Admin may create/edit/activate/deactivate groups and assign companies. VX is documented as an example only; no seed data was added. Group membership does not grant company access; `user_companies` / `assertCompanyAccess` remain authoritative. Company context validation is unchanged. Monthly brand matrix and reporting engines were not implemented.

Files changed:

Created reporting-group domain/schemas, repository/service/actions, `/api/reporting-groups` routes, Settings Reporting Groups UI, unit/integration tests, migration `20260820260000_reporting_groups`. Updated Prisma schema, home Admin link, prerequisite tests, [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[TASK-011 Reporting Groups]].

Database changes:

Migration `20260820260000_reporting_groups` adds `company_groups` and `companies.reporting_group_id`. Applied with `pnpm prisma:migrate:deploy`. No currencies, invoices, payments, audit tables, or report engines.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 125 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 29 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. Reporting groups are organizational/reporting constructs only. Historical transaction ownership remains the original company/brand (enforced by not changing ownership models here).

Problems:

None blocking. Audit event foundation remains TASK-012.

Next task:

[[TASK-012 Audit Event Foundation]] (not started)

### 2026-08-20 — TASK-010

Work completed:

Implemented Admin company branding configuration as a company subresource. Stores company-specific invoice prefix, terms and conditions, email template reference, brand contact details, and logo file metadata. Logo uploads are validated by MIME, magic bytes, and 2 MB size limit, then persisted through StorageService (Cloudflare R2 when configured; local `.data/object-storage` in local/test). Staff cannot change branding. PDF rendering, email sending, and invoice sequence issuance were not implemented.

Files changed:

Created branding domain/schemas/logo validation, branding repository/service/actions, StorageService adapters, `/api/companies/[id]/branding` and logo routes, Invoice Branding UI, unit/integration branding tests, migration `20260820250000_company_branding`. Updated Prisma Company model, company screens, prerequisite CRUD tests, `.env.example`, `.gitignore`, [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-006 consequences, [[TASK-010 Company Branding Configuration]].

Database changes:

Migration `20260820250000_company_branding` adds branding and logo metadata columns on `companies`. Applied with `pnpm prisma:migrate:deploy`. No invoice sequence, currencies, reporting groups, or gateway credentials. Logo binaries are not stored in PostgreSQL.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 120 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 27 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. ADR-006 StorageService introduced for logo objects ahead of PDF storage. Branding remains Admin/`company.write` only. Invoice numbering sequence remains TASK-035.

Problems:

None blocking. Reporting groups remain TASK-011.

Next task:

[[TASK-011 Reporting Groups]] (not started)

### 2026-08-20 — TASK-009

Work completed:

Implemented tenant isolation company context and the authenticated-layout header company switcher. Admin may select All Companies for consolidated reporting only. Transactional company-scoped actions require one concrete company and matching `company_id` (IDOR denied). Context is stored in httpOnly cookie `app-company-context` and revalidated against Admin ALL / assigned access on every resolve. Context change revalidates the app layout. Currencies, invoices, payments, branding, and reporting groups were not implemented. US-007–010 remain OPEN with default deny. `password_reset_required` remains workflow-only.

Files changed:

Created `src/domain/company-context/*`, `src/server/company-context/*`, header switcher UI, `/api/company-context` and transactional probe routes, unit/integration company-context tests. Updated authenticated layout/home, company store `listCompaniesByIds`, [[Authorization]], [[Security]], [[API and Integrations]], [[Error Handling]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[TASK-009 Tenant Isolation and Company Context]].

Database changes:

None. No new tables. Company context is cookie-based preference state, not a financial record.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 115 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 25 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. Admin All Companies remains reporting-only. Reporting groups are not authorization and were not introduced. Later transactional modules must reuse `assertTransactionalCompanyScope`.

Problems:

None blocking. Company branding remains TASK-010.

Next task:

[[TASK-010 Company Branding Configuration]] (not started)

### 2026-08-20 — TASK-008

Work completed:

Implemented user-company assignments. Admin may access all companies without assignment rows. Compliance and Staff are constrained to `user_companies` IDs via `assertCompanyAccess`. Admin user create/edit persists assigned company IDs. Unassigned company GET is denied with 403. Company switcher, reporting-group authorization, invoices, and payments were not implemented. US-007–010 remain OPEN with default deny. `password_reset_required` remains workflow-only.

Files changed:

Created `src/domain/authz/company-access.ts`, assignment UI fields, migration `20260820240000_user_company_assignments`, unit/integration assignment tests. Updated Prisma `UserCompany`, principal loading, user create/update, company GET access, user forms, [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[Authentication]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[TASK-008 User Company Assignments]].

Database changes:

Migration `20260820240000_user_company_assignments` adds `user_companies (user_id, company_id)`. Applied with `pnpm prisma:migrate:deploy`. No reporting groups, switcher state, currencies, invoices, or payments.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 103 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 22 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A (E2E-07 precursor covered in integration).

Decisions:

No new ADR. Assignments live only in the application database. Admin ALL is independent of stored assignment rows. Reporting groups are not used as authorization.

Problems:

None blocking. Header company switcher and per-request company context remain TASK-009.

Next task:

[[TASK-009 Tenant Isolation and Company Context]] (not started)

### 2026-08-20 — TASK-007

Work completed:

Implemented Admin company CRUD: create, list, view, edit, activate, and deactivate. Company records store identity, structured address, ISO country, contact details, optional registration/tax number, and Active/Inactive status. Invalid updates are rejected. There is no hard-delete. Gateway credentials, currencies, invoice numbering, logo/branding files, reporting groups, user-company assignments, and tenant isolation were not implemented.

Files changed:

Created `src/domain/companies/*`, `src/server/companies/*`, `/companies` UI, `/api/companies` routes, migration `20260820230000_company_crud`, unit/integration company-crud tests. Updated Prisma schema, home Admin link, prerequisite tests, [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[TASK-007 Company CRUD]].

Database changes:

Migration `20260820230000_company_crud` adds `companies` with identity/address/status/names. Applied with `pnpm prisma:migrate:deploy`. No `user_companies`, currencies, invoice prefix/sequence, logo, reporting group, or gateway credential columns/tables.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 97 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 20 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. All company HTTP/Server Action operations require `company.write` (Admin), including GET, so unassigned companies are not listed before TASK-008/009. ADR-011 reporting-currency default remains OPEN and was not stored on companies.

Problems:

None blocking. Company assignment remains the next task.

Next task:

[[TASK-008 User Company Assignments]] (not started)

### 2026-08-20 — TASK-006 bootstrap Admin CLI

Work completed:

Added operational `pnpm bootstrap:admin -- --email <user@example.com>` to solve the first-Admin chicken-and-egg without manual SQL. The command assigns the system ADMIN role in the application database only for an existing ACTIVE user already linked to Supabase Auth. It is idempotent for existing Admins, refuses non-Admin role replacement, does not create Auth users, does not accept passwords, and does not write Auth metadata. It is not a runtime authorization bypass; later role changes remain under User Management.

Files changed:

Created `src/domain/ops/bootstrap-admin.ts`, `src/ops/bootstrap-admin-store.ts`, `scripts/bootstrap-admin.ts`, unit/integration bootstrap tests. Updated `package.json` script, tsconfig include, [[Authentication]], [[Authorization]], [[Security]], [[Database]], [[TASK-006 User Management]], [[06 Development Log]].

Database changes:

None (uses existing `users.role_id` and seeded `roles`).

Tests:

Unit bootstrap safety/idempotency coverage. DB integration assigns once, re-runs idempotently, and refuses Staff replacement. Full suite re-verified with typecheck/lint/format/test/integration/build as applicable.

Decisions:

No new ADR. Kept bootstrap outside HTTP/Server Action surfaces so it cannot become an application backdoor.

Problems:

None blocking. Production use of the CLI still requires restricted access to `DATABASE_URL` / operator credentials.

Next task:

[[TASK-007 Company CRUD]] (not started)

### 2026-08-20 — TASK-006

Work completed:

Implemented Admin user management: create/edit/suspend/require password reset. Account fields include name, email, role, employee ID, optional MFA status, status, last login, and `password_reset_required` as a workflow/session flag only (never a role or permission). Supabase Auth Admin API provisions Auth users; application DB owns authorization fields. Suspended users cannot log in or remain in the app shell. Company assignment, MFA challenge productization, and the `audit_logs` store were not implemented.

Files changed:

Created `src/domain/users/*`, `src/server/users/*`, Supabase admin client, active-user gate, `/users` UI, `/api/users` routes, migration `20260820220000_user_management`, unit/integration user-management tests. Updated Prisma users fields, env service-role requirement, login/suspend behavior, home Admin link, [[Authentication]], [[Authorization]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], [[TASK-006 User Management]].

Database changes:

Migration `20260820220000_user_management` adds `users.employee_id`, `users.mfa_enabled`, `users.created_by_user_id`. Applied with `pnpm prisma:migrate:deploy`. No company, credential, or audit_logs tables.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 82 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 16 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. Optional Staff policies remain OPEN and default-deny. `password_reset_required` stays workflow/session state only. Live Auth provisioning uses service role only inside the Admin adapter; integration CRUD mocks that boundary.

Problems:

None blocking. Bootstrap Admin may still need a manual `role_id` assign before first UI manage session. Company assignment remains TASK-008.

Next task:

[[TASK-007 Company CRUD]] (not started)

### 2026-08-20 — TASK-005

Work completed:

Implemented Admin, Compliance, and Staff RBAC in the application database and domain layer. Permission checks use `assertPermission`; unauthenticated requests get 401 and other denials get 403. Optional Staff policies US-007–010 are recorded and denied. Customer/invoice/financial hard-delete helpers always return false. `GET /api/roles` is the representative Admin-only action. Login still does not assign a role. Roles are never read from Supabase Auth metadata.

Files changed:

Created `src/domain/authz/*`, `src/server/authz/*`, `GET /api/roles`, migration `20260820210000_roles_and_permissions`, [[Authorization]], unit/integration RBAC tests. Updated Prisma `users.role_id`, identity/architecture tests, [[Authentication]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], ADR-003 consequences, [[Unresolved Source Items]].

Database changes:

`roles`, `permissions`, `role_permissions` seeded from the Roles and Permissions matrix. Optional `users.role_id`. Applied with `pnpm prisma:migrate:deploy`. No companies, user_companies, customers, invoices, or payments.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 76 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 13 passed, 1 skipped (recovery-link). `pnpm build` pass. Playwright E2E N/A.

Decisions:

No new ADR. Optional Staff grants were not invented. Issued-invoice *capability* `invoice.edit_issued` is granted to Admin/Compliance; the financial edit workflow remains ADR-009 OPEN.

Problems:

None blocking. Company assignment remains TASK-008/009.

Next task:

[[TASK-006 User Management]] (not started)

### 2026-08-20 — TASK-004

Work completed:

Implemented Supabase Auth password recovery and reset on Next.js App Router. Forgot Password and Reset Password screens use React Hook Form + Zod + shadcn/ui. Recovery emails are sent by Supabase Auth, not Resend. The callback exchanges PKCE/OTP server-side, rejects expired/invalid/malformed links, and never logs tokens. Password update uses `updateUser`; sessions are signed out globally afterward. `users.password_reset_required` is an application workflow flag only. Recovery redirects use trusted `APP_URL` paths. Rate limiting reuses the in-memory `AuthRateLimiter` boundary.

Files changed:

Created recovery/reset domain and server modules, forgot/reset screens, `/auth/callback`, `/api/auth/forgot-password`, `/api/auth/reset-password`, migration `20260820200000_password_reset_required`, unit/integration tests. Updated env (`APP_URL`), rate limiter, identity mapping, proxy public paths, login UI, logger redaction, [[Authentication]], [[Security]], [[API and Integrations]], [[Database]], [[00 Home]], [[04 Implementation Status]], [[03 Implementation Plan]], [[Phase 01 Foundation]], [[TASK-004 Password Reset and Session Controls]].

Database changes:

Migration `20260820200000_password_reset_required` adds `users.password_reset_required`. Applied with `pnpm prisma:migrate:deploy`. No password, password_hash, reset_token, role, permission, or company columns.

Tests:

`pnpm typecheck` pass. `pnpm lint` pass. `pnpm format:check` pass. `pnpm test` 66 passed. `RUN_DB_INTEGRATION=true RUN_AUTH_INTEGRATION=true pnpm test:integration` 10 passed, 1 skipped (generated recovery-link; no service role). `pnpm build` pass. Playwright E2E NOT RUN (TASK-004 E2E is N/A).

Live verification:

- Generic recovery response for known and unknown emails: PASS (no account enumeration)
- Authenticated password update, session cleared, original password restored: PASS
- Identity mapping still has no role/company authorization metadata: PASS
- Recovery email click / mailbox callback: SKIPPED. The dedicated test account hit Supabase `over_email_send_rate_limit`. No test mailbox or `SUPABASE_SERVICE_ROLE_KEY` / `RUN_RECOVERY_INTEGRATION` was available. Not marked passed.

Decisions:

No new ADR. Recovery email remains a Supabase Auth identity flow; EmailService/Resend is not used. Provider errors after a valid recovery request still return the generic success message. In-memory rate limiting is process-local, same Redis replacement path as login.

Problems:

Supabase email send rate limit on the shared test account prevented a live recovery-link click-through. Documented as SKIPPED rather than passed.

Next task:

[[TASK-005 Roles and Permissions Model]] (not started)

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
