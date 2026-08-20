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

- Rate-limit login, password reset, and sensitive API actions. TASK-003 rate-limits login through an application `LoginRateLimiter` boundary. The current implementation is **in-memory and process-local**; it is not globally effective across multiple application containers. The future production mechanism is Redis. Password-reset limiting is [[TASK-004 Password Reset and Session Controls]].

- MFA strongly recommended for Admin and Compliance.

- Encryption at rest for payment gateway/API secrets using application-managed key/envelope encryption.

- Never store raw card numbers, CVV, or sensitive authentication data; use hosted/tokenized gateway flows.

- Principle of least privilege for application/database/cloud credentials.

- Company-level authorization enforced server-side. Not implemented in TASK-003; authentication only proves identity.

- Audit log access restricted and sensitive values masked.

- File uploads validated by MIME/type/size; malware scanning recommended if supporting arbitrary attachments.

- Security headers and content-security policy appropriate to the frontend architecture.

- Dependency vulnerability scanning in CI/CD recommended.

TASK-003 identity implementation: [[Authentication]]. Never treat Supabase Auth metadata as application authorization.

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
