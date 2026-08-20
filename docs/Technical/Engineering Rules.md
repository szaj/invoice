---
type: technical
status: approved
tags:
  - architecture
  - technical
---

# Engineering Rules

Permanent rules for Cursor and developers. Product requirements remain in [[01 Master Spec]]. Stack decisions: [[05 Architecture Decisions]].

These rules also exist as always-apply Cursor rules under `.cursor/rules/`.

## Payment Rule

Core payment business logic must never depend on Stripe, PayPal, Authorize.Net, or any other specific payment provider.

All provider-specific SDK calls, payloads, webhook handling, status mapping, credentials, and provider behavior must remain inside provider adapters/integration boundaries.

Adding a new payment provider must not require redesigning the core payment domain.

See [[05 Architecture Decisions#ADR-008 — Payment provider architecture|ADR-008]] and [[Payments]].

## Money Rule

Never use JavaScript floating-point arithmetic for authoritative money.

Use Prisma Decimal / PostgreSQL NUMERIC or DECIMAL.

Historical fixed-rate snapshots must never be recalculated.

Shared helpers live in `src/domain/money` ([[TASK-019 Money Calculation Utilities]]). Do not duplicate formulas in React, Route Handlers, Server Actions, or payment adapters.

See [[05 Architecture Decisions#ADR-004 — Money representation|ADR-004]] and [[Currency and Conversion]].

## Authorization Rule

Supabase Auth proves identity.

The application database/domain layer determines authorization.

Every company-scoped server operation must verify both permission and company access.

Frontend visibility is not authorization.

`authenticated = authorized` is never valid.

See [[05 Architecture Decisions#ADR-003 — Authentication|ADR-003]], [[Roles and Permissions]], [[Companies and Brands]], [[Security]].

## Financial Immutability Rule

Confirmed financial records must not be silently edited or hard-deleted.

Corrections must use controlled adjustment, reversal, refund, chargeback, or versioning workflows defined by the specification.

See [[Invoices]], [[Payments]], [[Refunds Disputes Chargebacks]], [[Business Rules]].

## Related

- [[02 Architecture]]
- [[05 Architecture Decisions]]
- [[00 Home]]
