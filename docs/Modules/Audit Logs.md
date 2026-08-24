---
type: module
status: approved
phase: 7
domain: compliance
tags:
  - module
  - security
---

# Audit Logs

> [!abstract] Related
> [[Security]] · [[Compliance]] · [[Roles and Permissions]] · [[Payments]] · [[Settings]] · [[00 Home]]

Audit history is a control feature, not an optional activity feed. Records should be append-only from the application layer and protected from ordinary modification or deletion.

TASK-012 implements the `audit_logs` store and writers for login success/failure/logout plus user create/update/suspend and company create/update/status. Later Admin writers include system settings, currencies, company currencies (`companies.currencies_updated`), fixed conversion rates (`fixed_rates.created` / `scheduled` / `activated` / `expired` / `superseded`), settlement currency updates (`settlement.currencies_updated`), customer create/update/status (`customers.created` / `customers.updated` / `customers.status_changed`), customer company linkage (`customers.companies_updated`), and customer notes (`customers.note_created`). TASK-045 writes payment creation/confirmation/failure (`payments.created` / `payments.confirmed` / `payments.failed`) without credentials. Sensitive keys are masked before persistence. Pino remains operational logging only ([[05 Architecture Decisions#ADR-014 — Logging|ADR-014]]). The audit viewer UI/API is TASK-076.

| Audit Field | Requirement |
| --- | --- |
| Event ID | Unique ID. |
| Timestamp | UTC storage; display in user/company timezone. |
| Actor | User ID or System/Webhook. |
| Company | Company context. |
| Entity Type / ID | Customer, invoice, payment, company, user, settings, etc. |
| Action | Create, update, send, status change, login, payment confirmation, gateway change, etc. |
| Old Values | Structured changed fields where relevant; sensitive values masked. |
| New Values | Structured changed fields where relevant; sensitive values masked. |
| Reason | Mandatory for controlled financial/status changes where configured. |
| IP Address | For user-originated security-relevant events. |
| User Agent | Recommended for security audit. |
| Correlation ID | Recommended for tracing API/webhook activity. |


### 12.1 Mandatory Audit Events

- Login success/failure and logout.

- User creation, role/company assignment changes, suspension.

- Company creation/update/status.

- Currency/rate/settings changes.

- Fixed-rate version created, scheduled, activated, expired, or superseded.

- Customer creation/update/deactivation.

- Invoice create/edit/issue/send/cancel/revision.

- PDF generation/version.

- Payment creation/pending/success/failure/refund/reversal.

- Manual payment confirmation.

- Compliance review status and notes.

- Gateway enable/disable/configuration changes (never log secret values).

- Report exports containing financial data.

- Dispute opened/updated/resolved; refund/partial refund recorded; chargeback debit/loss recorded; chargeback won/reversal recorded.


## Related Documentation

### Depends On

- [[Roles and Permissions]]
- [[Security]]

### Integrates With

- [[Compliance]]
- [[Payments]]
- [[Invoices]]
- [[Settings]]
- [[Refunds Disputes Chargebacks]]

### Technical

- [[Business Rules]]
- [[Testing]]

> [!danger] Financial immutability
> Confirmed financial transactions must preserve historical values. Corrections use adjustment/reversal workflows rather than silently editing historical records.
> Also see [[Invoices]] · [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Currency and Conversion]] · [[Business Rules]] · [[Audit Logs]] · [[Testing]]

> [!warning] Payment adjustments
> Refunds, disputes, and chargebacks create linked adjustment records. The original successful payment remains preserved.
> Also see [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Audit Logs]] · [[Dashboard and Reporting]] · [[Business Rules]] · [[Testing]]
