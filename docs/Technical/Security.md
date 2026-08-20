---
type: technical
status: approved
tags:
  - technical
  - security
---

# Security

> [!important] Identity vs authorization
> **Supabase Auth** proves identity. Application PostgreSQL/domain remains authoritative for roles, permissions, and company access. `authenticated = authorized` is invalid. See [[05 Architecture Decisions#ADR-003 — Authentication|ADR-003]] and [[Engineering Rules]].

> [!abstract] Related
> [[Roles and Permissions]] · [[Audit Logs]] · [[API and Integrations]] · [[Error Handling]] · [[Deployment]] · [[Authentication]] · [[00 Home]]

### 20.1 Security

- HTTPS only in all non-local environments.

- Modern password hashing (Argon2id/bcrypt or framework-recommended equivalent). Login credentials are stored by **Supabase Auth**, not in the application `users` table.

- CSRF protection where applicable and secure session cookies.

- Rate-limit login, password reset, and sensitive API actions. Login and password recovery use the application `AuthRateLimiter` boundary. The current implementation is **in-memory and process-local**; it is not globally effective across multiple application containers. The future production mechanism is Redis. See [[Authentication]].

- MFA strongly recommended for Admin and Compliance.

- Encryption at rest for payment gateway/API secrets using application-managed key/envelope encryption.

- Never store raw card numbers, CVV, or sensitive authentication data; use hosted/tokenized gateway flows.

- Principle of least privilege for application/database/cloud credentials.

- Company-level authorization enforced server-side. TASK-005 adds application roles/permissions. TASK-006 adds Admin user management under `user.manage`. TASK-007 adds Admin company CRUD under `company.write` (identity/address/status only; no hard-delete). TASK-008 stores `user_companies` and enforces Admin ALL vs Compliance/Staff assigned access (`assertCompanyAccess`). TASK-009 adds the header company switcher and per-request company context (`app-company-context` cookie); Admin All Companies is reporting-only; transactional actions require a concrete company. TASK-010 adds Admin company branding under `company.write` (invoice prefix, terms, email template reference, brand contact, logo metadata); Staff cannot change branding. File uploads are validated by MIME/magic bytes and size before StorageService persistence. TASK-011 adds Admin reporting groups (`company_groups` / `reporting_group_id`) for roll-up reporting only; membership never grants company access. TASK-012 adds append-only `audit_logs` for login and user/company admin events with sensitive-value masking; no update/delete APIs; viewer remains TASK-076 (`audit.read` Admin/Compliance; Staff US-010 OPEN/denied). TASK-013 adds Admin system settings under `settings.manage` (`system_settings`: reporting currency, timezone defaults, rounding tolerance placeholder); secrets must not be stored there unencrypted; ADR-011 remains OPEN. TASK-014 adds the global `currencies` catalog (Admin `currency.manage` create/edit/disable; soft-disable only; BR-011). TASK-015 adds per-company `company_currencies` (enabled subset + default invoice currency) under `company.write`; enabling globally INACTIVE currencies is rejected (BR-002). TASK-016 adds Admin fixed conversion rates under `currency.manage` (`fixed_conversion_rates`; create-only; never market/gateway FX). TASK-017 expires prior ACTIVE rate versions on create (append-only history retained; no PATCH of historical `fixed_rate`). TASK-020 adds Admin settlement currency enablement under `gateway.credentials.manage` (`payment_gateway_configs` / `payment_gateway_settlement_currencies`; reject non-enabled settlement currency; no credentials or live charges). The `bootstrap:admin` CLI is operational-only for first Admin / recovery and is not a runtime backdoor. `authenticated = authorized` remains invalid.

- Audit log access restricted and sensitive values masked.

- File uploads validated by MIME/type/size; malware scanning recommended if supporting arbitrary attachments. Company logos (TASK-010) allow PNG/JPEG/WebP up to 2 MB with magic-byte checks; bytes are stored via StorageService, not in PostgreSQL columns.

- Security headers and content-security policy appropriate to the frontend architecture.

- Dependency vulnerability scanning in CI/CD recommended.

TASK-003/TASK-004 identity implementation: [[Authentication]]. TASK-005 RBAC and TASK-006 Admin user management: [[Authorization]]. Never treat Supabase Auth metadata as application authorization. Recovery tokens, access tokens, refresh tokens, passwords, cookies, authorization headers, and service-role keys must not be logged. Password-recovery redirects must use trusted application URLs (`APP_URL`); arbitrary client-supplied redirects are rejected. `password_reset_required` is workflow/session state only.

### 20.2 Performance and Scalability

| Area | Target / Requirement |
| --- | --- |
| Standard UI pages | Typical authenticated page response/API p95 target under ~2 seconds under normal load. |
| Lists | Server-side pagination, filtering, sorting. |
| Reports | Large reports may run as background export jobs; UI remains responsive. |
| PDF generation | Queueable; generated file stored once per version. |
| Webhooks | Idempotent and resilient to retries. |
| Database | Indexes on company_id, customer_id, invoice number, status, dates, transaction IDs, and common report filters. |


### 20.3 Availability and Data Integrity

- Transactional database operations for invoice/payment updates.

- Foreign key constraints where supported.

- Unique constraints for invoice numbers and gateway event/transaction identifiers as appropriate.

- Daily automated backups minimum; point-in-time recovery recommended for production database.

- Object storage versioning/retention recommended for invoice PDFs.

- All timestamps stored in UTC; rendered in configured user/company timezone.


## Related Documentation

### Depends On

- [[Roles and Permissions]]

### Integrates With

- [[Audit Logs]]
- [[API and Integrations]]
- [[Error Handling]]
- [[Deployment]]

### Technical

- [[Testing]]
- [[Business Rules]]
- [[Data Model]]

> [!warning] Company isolation
> Every company-scoped operation must enforce company access **server-side**. Frontend hiding is not authorization.
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[Business Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]
