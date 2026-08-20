---
type: decision
status: approved
tags:
  - architecture
  - decision
---

# Architecture Decisions

Index of architecture decisions. Accepted items are authoritative for implementation.

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Next.js App Router + TypeScript + Node.js + pnpm | ACCEPTED |
| ADR-002 | Supabase PostgreSQL + Prisma | ACCEPTED |
| ADR-003 | Supabase Auth for identity; application-owned authorization | ACCEPTED |
| ADR-004 | Prisma Decimal + PostgreSQL NUMERIC/DECIMAL | ACCEPTED |
| ADR-005 | BullMQ + Redis + dedicated worker | ACCEPTED |
| ADR-006 | Cloudflare R2 via S3-compatible StorageService | ACCEPTED |
| ADR-007 | Resend via EmailService / EmailProvider | ACCEPTED |
| ADR-008 | Provider-agnostic PaymentProvider registry and adapters | ACCEPTED |
| ADR-009 | Issued invoice financial edit policy | OPEN |
| ADR-010 | Discount model | OPEN |
| ADR-011 | Reporting/base currency default | OPEN |
| ADR-012 | UI stack: Tailwind, shadcn/ui, React Hook Form, Zod, TanStack Table | ACCEPTED |
| ADR-013 | PDF generation with React-pdf | ACCEPTED |
| ADR-014 | Structured logging with Pino | ACCEPTED |
| ADR-015 | Monitoring with Sentry | ACCEPTED |
| ADR-016 | Testing with Vitest + Playwright | ACCEPTED |
| ADR-017 | Deployment: Docker + Linux VPS + Caddy | ACCEPTED |
| ADR-018 | CI/CD with GitHub Actions | ACCEPTED |
| ADR-019 | Code quality: ESLint, Prettier, strict TypeScript | ACCEPTED |
| ADR-020 | Next.js server layer; no separate Express/Nest backend | ACCEPTED |
| ADR-021 | Centralized typed environment/configuration | ACCEPTED |

Use [[Architecture Decision]] to add new ADRs. Permanent engineering rules: [[Engineering Rules]].

See also [[Unresolved Source Items]] and [[02 Architecture]].

Accepted: 20 August 2026, unless a later ADR supersedes it.

---

## ADR-001 — Application framework

Status: ACCEPTED

Date: 2026-08-20

### Context

The system needs a web UI and a server-side application/domain layer. Source requirements were implementation-agnostic.

### Decision

Use **Next.js** (App Router) with **TypeScript** and **Node.js**. Package manager: **pnpm**.

Next.js provides both the frontend and the server-side application layer.

Use:

- Server Components where appropriate
- Client Components where browser interactivity is required
- Route Handlers for HTTP/API endpoints
- Server Actions where they genuinely simplify workflows

Do **not** place core business logic directly inside React components, Route Handlers, or Server Actions. Domain logic must remain reusable and independently testable.

### Reason

Approved as the project technology stack before application development.

### Alternatives Considered

Laravel or other mature equivalents mentioned as a historical “strong fit” in [[Deployment]]. Not selected.

### Consequences

[[TASK-001 Repository Foundation]] must establish the repository using this stack. There is no remaining framework blocker for TASK-001.

### Related Documents

- [[02 Architecture]]
- [[Deployment]]
- [[Engineering Rules]]
- [[TASK-001 Repository Foundation]]
- [[05 Architecture Decisions#ADR-020 — Next.js server layer|ADR-020]]

---

## ADR-002 — Database

Status: ACCEPTED

Date: 2026-08-20

### Context

A relational database is required for transactional invoice/payment updates, constraints, and reporting.

### Decision

Use **Supabase PostgreSQL** as the authoritative relational application database.

Use **Prisma** for schema definition, database access, migrations, relations, and transactions.

Use PostgreSQL constraints in addition to application validation. Important financial and integrity rules must not depend only on UI validation.

Do not create a separate application database unless a later ADR explicitly changes this.

### Reason

Approved as the project database and ORM.

### Alternatives Considered

MySQL/MariaDB or another relational database. Not selected.

### Consequences

[[TASK-002 Database Foundation]] uses Prisma against Supabase PostgreSQL. Money columns use NUMERIC/DECIMAL via Prisma Decimal. [[05 Architecture Decisions#ADR-004 — Money representation|ADR-004]].

Prisma ORM v7 configuration used by this repository:

- Prisma CLI (`migrate`, `studio`) reads **`DIRECT_URL`** from `prisma.config.ts`.
- Application runtime uses pooled **`DATABASE_URL`** with `@prisma/adapter-pg`.
- Production schema changes use Prisma migrations, not `db push`.

This is how ADR-002 is applied; it is not a separate database product.

### Related Documents

- [[Data Model]]
- [[Deployment]]
- [[Security]]
- [[Database]]
- [[TASK-002 Database Foundation]]

---

## ADR-003 — Authentication

Status: ACCEPTED

Date: 2026-08-20

### Context

The internal application requires secure login, password reset, sessions, roles, company assignment, and optional MFA.

### Decision

Use **Supabase Auth** for:

- user identity
- login / logout
- password authentication and recovery
- authentication sessions
- authentication-related identity flows

Supabase Auth is **not** the authoritative application authorization system.

The application database remains authoritative for:

- application user records
- roles and permissions
- user-company assignments
- company access
- financial, compliance, and administrative permissions

The application `users` record must maintain a stable relationship to the corresponding Supabase Auth user identifier.

Authentication answers: *Who is this user?*  
Authorization answers: *What may this user do, and for which company?*

Never treat `authenticated = authorized` as valid logic.

Credential hashing for login lives in Supabase Auth. Do not maintain a second password store as the login authority. Spec `password_hash` on `users` is satisfied by the identity provider, not a parallel credential table.

### Reason

Approved identity provider with an explicit authorization boundary required by [[Roles and Permissions]] and [[Security]].

### Alternatives Considered

Framework-native sessions as the identity store. Not selected.

### Consequences

[[TASK-003 Authentication Base]] and [[TASK-004 Password Reset and Session Controls]] use Supabase Auth for identity flows. RBAC and company isolation remain application-domain work in later tasks.

MFA remains strongly recommended for Admin and Compliance as specified.

### Related Documents

- [[Roles and Permissions]]
- [[Security]]
- [[API and Integrations]]
- [[Engineering Rules]]
- [[TASK-003 Authentication Base]]

---

## ADR-004 — Money representation

Status: ACCEPTED

Date: 2026-08-20 (stack detail); original decimal rule from the specification

### Context

The product is a financial system with invoices, payments, fixed conversion rates, fees, and reporting across currencies.

### Decision

Use **Prisma Decimal** and PostgreSQL **NUMERIC / DECIMAL** for authoritative money.

Never use standard JavaScript floating-point arithmetic (`number` addition/multiplication) for authoritative monetary calculations.

This applies to invoice subtotals, discounts, tax, totals, payment allocations, outstanding balances, fixed-rate conversion, settlement amounts, refunds, partial refunds, chargebacks, reversals, CB/RF, reporting totals, reporting-currency conversion, and rounding.

Create a centralized financial calculation/domain layer. Do not duplicate formulas in React components, Route Handlers, Server Actions, or provider adapters.

Store currency code with every monetary value that is not unambiguously inherited. Conversion rates need 8–12 decimal places. Rounding is defined server-side; client totals are display-only and must be revalidated by the backend.

### Reason

Required by [[Data Model]] 17.2 and now bound to Prisma/PostgreSQL types.

### Alternatives Considered

IEEE floating-point money — rejected. Integer minor-units — not specified; do not switch unless a later ADR supersedes this.

### Consequences

[[TASK-019 Money Calculation Utilities]] is the centralized money layer. Historical snapshots are never recalculated.

### Related Documents

- [[Data Model]]
- [[Currency and Conversion]]
- [[Business Rules]]
- [[Testing]]
- [[Engineering Rules]]
- [[TASK-019 Money Calculation Utilities]]

---

## ADR-005 — Background jobs

Status: ACCEPTED

Date: 2026-08-20

### Context

Webhooks should respond quickly. PDF generation, large reports, and email may be expensive or retryable.

### Decision

Use **BullMQ** + **Redis** + a **dedicated worker process**.

```text
Next.js Application → Queue → BullMQ → Redis → Dedicated Worker
```

Candidates: PDF generation, transactional email, large reports, CSV/XLSX/PDF exports, webhook post-processing where appropriate, notifications, retryable integrations.

Do not make ordinary user interactions asynchronous without cause. Use queues when work is expensive, retryable, or should not block an HTTP request.

Redis must **not** be the authoritative store for financial records. PostgreSQL remains the source of truth.

Initial production Redis may run inside the Docker/VPS environment. Keep Redis access behind application/job abstractions.

### Reason

Approved job architecture.

### Alternatives Considered

Synchronous-only processing; unspecified queue products. Not selected.

### Consequences

[[TASK-099 Queue Hardening]] uses BullMQ/Redis/worker. Job usage may begin earlier for PDF/email/webhooks without changing those tasks’ functional scope.

### Related Documents

- [[API and Integrations]]
- [[PDF and Email]]
- [[Dashboard and Reporting]]
- [[Deployment]]
- [[TASK-099 Queue Hardening]]

---

## ADR-006 — Object storage

Status: ACCEPTED

Date: 2026-08-20

### Context

Invoice PDFs and related files must be stored as versioned documents, not as large BLOBs in ordinary relational fields.

### Decision

Use **Cloudflare R2** through an S3-compatible abstraction:

```text
Application → StorageService → S3-compatible adapter → Cloudflare R2
```

Cloudflare R2 is the initial provider. Domain logic must not call Cloudflare-specific APIs where the S3-compatible adapter is sufficient.

Store file metadata in PostgreSQL. Do not store large binaries in ordinary database columns.

Supports invoice PDFs and versions, compliance evidence, permitted attachments, and generated exports where applicable.

A future alternative S3 provider may be introduced behind the same abstraction without rewriting domain logic.

### Reason

Approved storage architecture.

### Alternatives Considered

Local filesystem as production storage; vendor-specific R2 SDK in domain code. Rejected for production/domain coupling.

### Consequences

[[TASK-039 PDF Generation]] stores files through StorageService. Historical PDFs remain retrievable and must not be regenerated from today’s mutable data when an immutable version exists.

### Related Documents

- [[PDF and Email]]
- [[Data Model]]
- [[Deployment]]
- [[TASK-039 PDF Generation]]

---

## ADR-007 — Transactional email

Status: ACCEPTED

Date: 2026-08-20

### Context

The system emails branded invoices and operational notifications.

### Decision

Use **Resend** behind an email abstraction:

```text
Application → EmailService → EmailProvider → ResendAdapter
```

Core modules must not call the Resend SDK directly. Another transactional provider may be introduced later without rewriting invoice or notification domain logic.

Email failure must not un-issue an invoice. Delivery logs and retry remain required. No customer-portal notifications in Version 1.

### Reason

Approved email architecture.

### Alternatives Considered

Raw SMTP from domain modules. Not selected as the application boundary.

### Consequences

[[TASK-041 Email Delivery]] and [[TASK-091 Operational Notifications]] send through EmailService.

### Related Documents

- [[PDF and Email]]
- [[Notifications]]
- [[Settings]]
- [[Error Handling]]
- [[TASK-041 Email Delivery]]

---

## ADR-008 — Payment provider architecture

Status: ACCEPTED

Date: 2026-08-20 (extended)

### Context

Version 1 must support Stripe, PayPal, a generic bank/card processor adapter, and manual payments. Future providers must be addable without redesigning the payment domain.

### Decision

The payment system is **provider-agnostic and extensible**.

```text
Payment Domain
      ↓
Payment Application Service
      ↓
PaymentProvider Registry
      ↓
PaymentProvider
      ├── StripeAdapter
      ├── PayPalAdapter
      ├── BankProcessorAdapter
      ├── ManualPaymentAdapter
      ├── AuthorizeNetAdapter        [future, not Version 1]
      └── FutureProviderAdapter
```

Do not make core payment logic depend on Stripe, PayPal, Authorize.Net, or any other vendor.

Provider operations (implement the TypeScript contract in the relevant task, not in this ADR-update):

- `createPaymentRequest()`
- `getPaymentStatus()`
- `parseWebhook()`
- `verifyWebhook()`
- `refundPayment()`
- `getFees()`
- `healthCheck()`

Providers expose **capabilities** (for example `supportsHostedCheckout`, `supportsWebhooks`, `supportsRefunds`, `supportsPartialRefunds`, `supportsFeeRetrieval`, `supportsPaymentStatusLookup`, `supportsMultipleSettlementCurrencies`, `supportsHealthCheck`). The application uses capabilities, not `if (provider === "stripe")` in core logic. Provider-specific branching belongs in adapters/registry.

Core payment records hold normalized business fields (internal IDs, company/invoice/customer, provider/method identifier, external reference, status, currencies, amounts, Admin rate snapshot, converted settlement, optional fee, optional actual received, dates, source, actor). Isolate provider-specific metadata. Do not add dozens of Stripe-only or PayPal-only columns to the core payment table.

Provider SDKs, credentials, payloads, webhook event names, status mapping, and fee extraction stay inside adapters. The domain receives normalized results.

Application payment status remains **Pending / Successful / Failed**. Refunds, disputes, and chargebacks are linked adjustments. The original successful payment is never rewritten or hard-deleted through ordinary workflows.

Gateways never determine the Admin fixed conversion rate. Merchant fees never change invoice balance, rate, or converted settlement.

Webhooks: signature verification where supported, unique external event IDs, idempotency, safe retries, correlation IDs, audit events. Duplicate webhooks must not create duplicate payments. Do not mark paid from an unauthenticated client claim.

**Manual payments** use the same domain rules without fake webhooks.

**Future providers** (Authorize.Net, Adyen, Braintree, Checkout.com, Square, local acquirers, and others) are **not** Version 1 scope. Adding one should mean: adapter, capabilities, status mapping, webhooks if supported, company configuration, registry registration, tests — not a rewrite of invoices, allocation, FX, refunds, CB/RF, reporting, or audit.

Gateway configuration is **company-specific** (enabled, encrypted credentials, sandbox/live, settlement currencies, webhook config, health). Credentials never exposed to unauthorized Staff.

Core reporting uses normalized application payment records so a later provider appears in generic gateway reporting once records are normalized.

Payment audit events are application audit records, not provider API logs. Never store credentials or secret webhook fields in audit logs.

### Reason

Required by [[Payments]] and [[API and Integrations]], and explicitly approved as permanent architecture.

### Alternatives Considered

Direct Stripe/PayPal calls in domain/UI code; provider-name conditionals in allocation/reporting. Rejected.

### Consequences

[[TASK-048 Payment Provider Abstraction]] defines the registry, interface, and capabilities. Concrete adapters remain later tasks. Authorize.Net is an adapter-shaped future extension only.

### Related Documents

- [[Payments]]
- [[API and Integrations]]
- [[Security]]
- [[Refunds Disputes Chargebacks]]
- [[Dashboard and Reporting]]
- [[Engineering Rules]]
- [[TASK-048 Payment Provider Abstraction]]

---

## ADR-009 — Issued invoice financial edit policy

Status: OPEN

### Context

Issued financial documents should not be silently altered.

### Decision

Not accepted.

### Reason

[[Invoices]] recommends: minor non-financial metadata may be edited with audit history; financial changes require either a controlled revised invoice version with reason, or cancellation and reissue. The final implementation decision should be consistent across all companies.

### Alternatives Considered

Versioned revision, or cancel-and-reissue. Both are allowed by the source; one must be chosen later.

### Consequences

Do not implement silent edits of issued financial fields. Invoice versions and PDF history remain required either way. Historical PDFs must not be regenerated from today’s mutable data when an immutable version exists. [[05 Architecture Decisions#ADR-013 — PDF generation|ADR-013]]

### Related Documents

- [[Invoices]]
- [[PDF and Email]]
- [[Audit Logs]]
- [[Business Rules]]

---

## ADR-010 — Discount model

Status: OPEN

### Context

Invoice line items may include discount.

### Decision

Not accepted.

### Reason

[[Invoices]] says discount may be line or invoice level, percentage or fixed, and implementation should choose one consistent model or support both explicitly.

### Alternatives Considered

Percentage only, fixed only, or both, at line and/or invoice level.

### Consequences

Totals, PDFs, and tax snapshots must follow the chosen model consistently. Money math still uses [[05 Architecture Decisions#ADR-004 — Money representation|ADR-004]].

### Related Documents

- [[Invoices]]
- [[PDF and Email]]
- [[Data Model]]

---

## ADR-011 — Reporting/base currency default

Status: OPEN

### Context

Consolidated dashboard views need a reporting/base currency.

### Decision

Not accepted as a locked default.

### Reason

[[Definitions]] says reporting/base currency is configurable, with an initial recommendation of USD. [[Companies and Brands]] says reporting currency is typically USD and may be inherited from master settings.

### Alternatives Considered

USD as initial system default, with Admin configuration. Not formally accepted beyond the recommendation.

### Consequences

Mixed-currency totals must still not be shown as a single unlabeled amount. Converted values use stored snapshots. Reporting remains provider-neutral. [[05 Architecture Decisions#ADR-008 — Payment provider architecture|ADR-008]]

### Related Documents

- [[Definitions]]
- [[Companies and Brands]]
- [[Dashboard and Reporting]]
- [[Settings]]

---

## ADR-012 — UI stack

Status: ACCEPTED

Date: 2026-08-20

### Decision

Use **Tailwind CSS**, **shadcn/ui**, **React Hook Form**, **Zod**, and **TanStack Table**.

Forms: React Hook Form for complex interactive forms; Zod for validation. Frontend validation is UX only. Backend/domain validation is authoritative.

Tables: TanStack Table for complex tables (server-side pagination, sorting, filtering, column visibility, row actions, reporting). Do not load large financial datasets entirely into the browser.

### Related Documents

- [[Screen Inventory]]
- [[Dashboard and Reporting]]
- [[Security]]

---

## ADR-013 — PDF generation

Status: ACCEPTED

Date: 2026-08-20

### Decision

Use **@react-pdf/renderer** (React-pdf) for server-side branded invoice PDFs.

Must support company branding, invoice versioning, stable historical documents, and storage through [[05 Architecture Decisions#ADR-006 — Object storage|ADR-006]].

Do not regenerate an old invoice from today’s mutable company/invoice data if an immutable historical version already exists.

### Related Documents

- [[PDF and Email]]
- [[Invoices]]
- [[TASK-039 PDF Generation]]

---

## ADR-014 — Logging

Status: ACCEPTED

Date: 2026-08-20

### Decision

Use **Pino** for structured application logging.

Useful context: request/correlation ID, user ID, company ID, entity type/ID, integration/provider, operation.

Never log: raw passwords, card numbers, CVV, payment credentials, API secrets, webhook secrets, sensitive auth tokens.

Application logs are not the append-only business/security audit trail. See [[Audit Logs]].

### Related Documents

- [[Security]]
- [[Audit Logs]]
- [[Error Handling]]

---

## ADR-015 — Monitoring

Status: ACCEPTED

Date: 2026-08-20

### Decision

Use **Sentry** for application/server/frontend exceptions, integration failures where appropriate, and tracing/performance where useful.

Do not send payment credentials or prohibited payment data to Sentry.

### Related Documents

- [[Deployment]]
- [[Security]]
- [[TASK-100 Monitoring]]

---

## ADR-016 — Testing

Status: ACCEPTED

Date: 2026-08-20

### Decision

**Vitest** for unit/integration. **Playwright** for E2E.

High-risk coverage must include financial Decimal calculations, invoice transitions, payment allocation, company isolation, RBAC, fixed-rate selection and historical preservation, webhook idempotency, duplicate payment prevention, refunds/partial refunds/chargebacks/reversals, CB/RF, and mixed-currency reporting.

### Related Documents

- [[Testing]]
- [[TASK-093 Authorization Testing]]
- [[TASK-094 Financial Calculation Testing]]
- [[TASK-096 E2E Test Suite]]

---

## ADR-017 — Deployment

Status: ACCEPTED

Date: 2026-08-20

### Decision

**Docker** + **Linux VPS** + **Caddy**.

```text
Internet → Caddy → Next.js container
                      ├── Supabase Auth
                      ├── Supabase PostgreSQL (managed externally)
                      ├── Cloudflare R2
                      ├── Resend
                      ├── Stripe / PayPal / future providers
Worker container → BullMQ → Redis container
```

Separate containers/processes for Next.js, worker, Redis, and Caddy. Supabase PostgreSQL is managed externally and must not be hosted on the application VPS.

The exact VPS vendor and DNS/domain provider remain **open** operational choices.

### Related Documents

- [[Deployment]]
- [[TASK-102 Staging UAT Environment]]
- [[TASK-103 Production Deployment]]

---

## ADR-018 — CI/CD

Status: ACCEPTED

Date: 2026-08-20

### Decision

Use **GitHub Actions**.

CI should eventually run TypeScript validation, linting, unit tests, integration tests, build validation, and relevant security/dependency checks. Playwright may be added when the environment supports reliable E2E.

### Related Documents

- [[Testing]]
- [[Deployment]]
- [[TASK-001 Repository Foundation]]

---

## ADR-019 — Code quality

Status: ACCEPTED

Date: 2026-08-20

### Decision

**ESLint** + **Prettier**. Package manager **pnpm**. Strict TypeScript.

Do not use `any` as a shortcut around domain typing unless a documented integration boundary needs temporary unknown data. Prefer `unknown` with explicit parsing/validation for external input.

### Related Documents

- [[TASK-001 Repository Foundation]]
- [[Engineering Rules]]

---

## ADR-020 — Next.js server layer

Status: ACCEPTED

Date: 2026-08-20

### Decision

Do not introduce a separate Express/Nest backend at this stage.

Keep boundaries:

```text
UI / HTTP Boundary
        ↓
Application Services
        ↓
Domain Services
        ↓
Repositories / Integrations
        ↓
Database / External Providers
```

Route Handlers and Server Actions coordinate use cases. They must not become large files containing all business logic.

### Related Documents

- [[API and Integrations]]
- [[02 Architecture]]
- [[05 Architecture Decisions#ADR-001 — Application framework|ADR-001]]

---

## ADR-021 — Environment and configuration

Status: ACCEPTED

Date: 2026-08-20

### Decision

Use environment variables for runtime configuration. Validate required variables at startup with **Zod** (or another centralized typed configuration layer).

Do not spread direct `process.env` access throughout the application.

Secrets must never be committed to Git.

Separate configuration for local, development, staging/UAT, and production.

Store authoritative timestamps in **UTC**. Display in configured user/company timezone. Payment effective dates and business dates remain conceptually separate from system timestamps where the specification requires it.

### Related Documents

- [[Security]]
- [[Deployment]]
- [[TASK-001 Repository Foundation]]
- [[TASK-013 Core System Settings]]

---

## Still open / deferred (not blockers for TASK-001)

| Topic | Status |
| --- | --- |
| Exact VPS vendor | OPEN operational |
| Exact domain/DNS provider | OPEN operational |
| Future payment gateways beyond Version 1 (Authorize.Net, etc.) | Deferred; adapter-shaped |
| Exact future bank/card processor brand | OPEN |
| Future alternative email provider | Deferred; EmailProvider-shaped |
| Future alternative S3 provider | Deferred; StorageService-shaped |
| ADR-009 issued invoice financial edits | OPEN product |
| ADR-010 discount model | OPEN product |
| ADR-011 reporting currency default | OPEN product |

The abstraction architecture is approved even when a future alternative vendor is not selected.
