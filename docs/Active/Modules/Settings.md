---
type: module
status: approved
phase: 1
domain: settings
tags:
  - module
---

# Settings

> [!abstract] Related
> [[Companies and Brands]] · [[Currency and Conversion]] · [[Roles and Permissions]] · [[Notifications]] · [[Security]] · [[00 Home]]

| Settings Area | Requirements |
| --- | --- |
| Companies | Create/edit/activate companies and branding. |
| Currencies | Create/disable currencies; symbols and decimal precision. TASK-014 implements the global `currencies` catalog (seeded USD, AED, PKR, GBP, AUD) under Admin `currency.manage`. Company enablement is TASK-015 (`company_currencies` under Admin `company.write`). Fixed conversion rates: TASK-016/017 under `/settings/fixed-rates` (`currency.manage`; append-only versions with expire-previous). TASK-021: disabled currencies stay visible historically; new-document pickers hide them. |
| Fixed Conversion Rates | Effective-dated rate versions by currency pair; monthly/yearly/manual labels, future scheduling, active/expired history, and prospective-only changes. No live FX provider. |
| Payment Methods | Enable/disable per company; allowed settlement currencies (TASK-020 under `/companies/{id}/settlement`, Admin `gateway.credentials.manage`). Credentials, sandbox/live, and status under `/companies/{id}/gateways` (TASK-049) with [[05 Architecture Decisions#ADR-022 — Gateway credential encryption|ADR-022]] envelope encryption. |
| Invoice Numbering | Company prefix (branding), per-company sequence (`invoice_sequence_next`), optional year component (`system_settings.invoice_number_include_year`), uniqueness within company (BR-003). |
| Invoice Templates | Logo, company fields, footer, terms, layout options. |
| Email Settings | SMTP/provider configuration or transactional email provider; brand sender identity. |
| Email Templates | Subject/body templates per company. |
| User Management | Users, roles, company access, status, reset password. |
| System | Reporting currency, timezone defaults, rounding tolerance, file retention, security policy. TASK-013 implements reporting currency (configurable; ADR-011 OPEN), timezone defaults, and rounding tolerance in `system_settings` under Admin `settings.manage`. TASK-091 adds operational notification enable flags on `system_settings` (defaults on except optional payment alerts); TASK-092 adds Admin toggle UI at `/settings/notifications`. TASK-100 adds Sentry monitoring (ADR-015) and Admin operational health at `/settings/operations` with public `/api/health`. TASK-101 adds backup health indicators and documents daily pg_dump + R2 versioning (ADR-024). TASK-019 uses rounding tolerance for within-tolerance zero comparisons in money helpers. File retention and security policy remain later. Secrets must not be stored here unencrypted. |
| Reporting Groups | Create/edit parent reporting groups and assign brands/companies for consolidated reports. |
| Refund / Chargeback Settings | Reason codes, permissions, evidence requirements, merchant case/reference fields, and financial-impact statuses. TASK-068 accepts `reason` (reason code) and `merchantReference` on adjustment note/cancel APIs against existing `payment_adjustments`; settings catalog UI and evidence attachments remain later. |


## Related Documentation

### Depends On

- [[Companies and Brands]]
- [[Roles and Permissions]]

### Integrates With

- [[Currency and Conversion]]
- [[Notifications]]
- [[Refunds Disputes Chargebacks]]

### Technical

- [[Security]]
