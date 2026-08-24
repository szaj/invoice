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

## UI / UX Design System Rule

All frontend work from [[TASK-042 Email Invoice UI]] onward must reuse [[UI UX Design System]].

Do not invent arbitrary page layouts, card/form/table styles, status colors, spacing, typography, or navigation patterns. Extend shared primitives instead.

Stack remains Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide, React Hook Form, Zod, and TanStack Table where appropriate. Do not introduce another UI framework.

Frontend visibility is not authorization. Authoritative validation stays server-side.

Cursor rule: `.cursor/rules/ui-ux.mdc`.

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

## Gateway Credential Encryption Rule

Gateway credentials use application-managed envelope encryption ([[05 Architecture Decisions#ADR-022 — Gateway credential encryption|ADR-022]]).

- Algorithm: AES-256-GCM via Node.js `node:crypto` or a well-maintained library — never custom crypto.
- KEK from versioned server-only env keyring (`GATEWAY_CREDENTIALS_KEY_VERSION`, `GATEWAY_CREDENTIALS_KEY_Vn`); never PostgreSQL; never `NEXT_PUBLIC_*`.
- Per-credential random DEK; wrap DEK with active KEK; persist ciphertext + nonces + auth tags + key/format versions only.
- Normal APIs return metadata such as `credentialsConfigured` — never plaintext, ciphertext, wrapped DEKs, nonces, tags, or keys.
- Decrypt only through server-only `GatewayCredentialService` → `CredentialCipher` → `KeyProvider`. Routes, Server Actions, RSC/client components, audit writers, and generic serializers must not decrypt.
- Explicit secret replacement; non-secret config updates must not erase credentials.
- Never log, audit, Sentry, or return plaintext credentials; never store them on `payments` or in Auth metadata.
- Fail closed on decrypt/auth failure. Production fails closed without a valid active KEK.

Cursor rule: `.cursor/rules/gateway-credentials.mdc`.

See [[Security]], [[Payments]], BR-008.

## Related

- [[02 Architecture]]
- [[05 Architecture Decisions]]
- [[00 Home]]
