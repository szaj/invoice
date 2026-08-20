---
type: foundation
status: approved
tags:
  - technical
---

# Data Model

> [!abstract] Related
> [[Companies and Brands]] · [[Customers]] · [[Invoices]] · [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Audit Logs]] · [[API and Integrations]] · [[00 Home]]

```mermaid
erDiagram
    companies ||--o{ invoices : owns
    companies ||--o{ payments : owns
    companies }o--o{ users : user_companies
    customers ||--o{ invoices : billed
    invoices ||--|{ invoice_items : contains
    invoices ||--o{ payments : paid_by
    invoices ||--o{ invoice_versions : versions
    payments ||--o{ payment_adjustments : adjusted_by
    payments ||--o{ payment_events : webhook
    companies }o--o{ currencies : company_currencies
    fixed_conversion_rates ||--o{ payments : snapshot
    company_groups ||--o{ companies : rollup
```

> [!note] Money storage
> Use Prisma Decimal mapped to PostgreSQL NUMERIC/DECIMAL — never JavaScript floating point for authoritative money. Store currency code with every monetary value. Conversion rates need 8–12 decimal places. Rounding is defined server-side; client totals are display-only. See [[05 Architecture Decisions#ADR-004 — Money representation|ADR-004]].

> [!note] Users and identity
> Application `users` must store a stable link to the Supabase Auth user identifier. Login credentials are not an application-owned second password store. See [[05 Architecture Decisions#ADR-003 — Authentication|ADR-003]].

The exact schema may vary by framework, but the following logical entities and relationships are required. Use immutable identifiers (UUIDs recommended for externally referenced records) and consistent created_at/updated_at timestamps.

| Entity | Key Purpose / Fields |
| --- | --- |
| users | id, name, email, password_hash, role_id, status, last_login_at, mfa fields. |
| roles / permissions | role definitions and granular permission mapping. |
| user_companies | user_id, company_id; controls company access. |
| companies | identity, branding, address, default currency, invoice prefix/sequence, optional reporting_group_id / parent group, status. |
| currencies | code, name, symbol, decimals, active. |
| company_currencies | company_id, currency_id, enabled/default flags. |
| fixed_conversion_rates | from_currency, to_currency, fixed_rate, version_no, frequency_label, valid_from, valid_to, status, notes, created_by, created_at. Versions are append-only/prospective; expired versions are retained. |
| customers | master customer information and status. |
| customer_companies | optional relation for company linkage/assignment. |
| invoices | company, customer, number, dates, currency, totals, statuses, assigned staff, compliance status. |
| invoice_items | invoice_id, description, qty, rate, discount, tax snapshot, total. |
| invoice_versions | invoice_id, version_no, financial/document snapshot metadata, reason, created_by. |
| invoice_files | invoice/version link, PDF storage path/key, checksum, created_at. |
| payments | invoice/company/customer, method, status, transaction ID, invoice currency applied, settlement currency, fixed conversion rate snapshot, converted settlement amount, optional merchant fee, optional actual received amount, dates, source. |
| payment_events | gateway webhook/events, unique external event ID, raw normalized status metadata; sensitive payload handling required. |
| payment_adjustments | linked original payment; type (refund/dispute/chargeback/reversal), amount, invoice-currency amount if applicable, settlement-currency amount, status, reason, merchant reference/case ID, opened/processed/resolved dates, created_by. Original payment is never overwritten. |
| payment_gateway_configs | company, gateway type, enabled, encrypted credentials reference, environment, supported settlement currencies. |
| compliance_reviews | entity, status, reviewer, notes, reason code, timestamps. |
| customer_notes | customer, author, note, visibility internal. |
| email_logs | invoice, recipient, subject, provider ID, status, sent_by, timestamps. |
| audit_logs | append-only event store fields defined earlier. |
| attachments | generic metadata for evidence/supporting docs if included. |
| system_settings | reporting currency, timezone defaults, policies; secrets should not be stored here unencrypted. |
| company_groups | Optional parent/reporting group for consolidated reporting (e.g., VX). Fields: id, name, code, status, display order. |


### 17.1 Key Relationships

| Company 1 -- * Invoices Company 1 -- * Payment Gateway Configurations Company * -- * Users (through user_companies) Customer 1 -- * Invoices Invoice 1 -- * Invoice Items Invoice 1 -- * Payments Invoice 1 -- * Invoice Versions / PDFs Payment 1 -- * Payment Events / Adjustments Customer * -- * Companies (optional linkage) User 1 -- * Audit Logs |
| --- |


### 17.2 Money Storage

- Use fixed-precision decimal types; never floating-point for money.

- Store currency code with every monetary value that is not unambiguously inherited.

- Use sufficient precision for fixed conversion rates (e.g., 8-12 decimal places) and 2+ decimals for currencies according to currency metadata.

- Define and document rounding rules server-side; client-side totals are display-only and must be revalidated by backend.


## Related Documentation

### Depends On

- [[Companies and Brands]]
- [[Currency and Conversion]]

### Integrates With

- [[Customers]]
- [[Invoices]]
- [[Payments]]
- [[Refunds Disputes Chargebacks]]
- [[Audit Logs]]

### Technical

- [[API and Integrations]]
- [[Security]]
- [[Testing]]

> [!warning] Company isolation
> Every company-scoped operation must enforce company access **server-side**. Frontend hiding is not authorization.
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[Business Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]

> [!danger] Fixed conversion rates
> Rates are Admin-defined and versioned. Historical payments retain the exact rate snapshot used. Changing a rate affects future transactions only. Never fetch, guess, or substitute a market/gateway rate.
> Also see [[Currency and Conversion]] · [[Payments]] · [[Business Rules]] · [[Data Model]] · [[Dashboard and Reporting]] · [[Testing]]
