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

TASK-012 implements the `audit_logs` store and writers for login success/failure/logout plus user create/update/suspend and company create/update/status. Later Admin writers include system settings, currencies, company currencies (`companies.currencies_updated`), fixed conversion rates (`fixed_rates.created` / `scheduled` / `activated` / `expired` / `superseded`), settlement currency updates (`settlement.currencies_updated`), gateway config updates (`gateway.config_updated`) and explicit credential replace (`gateway.credentials_replaced`) without secret values (TASK-049 / ADR-022), customer create/update/status (`customers.created` / `customers.updated` / `customers.status_changed`), customer company linkage (`customers.companies_updated`), and customer notes (`customers.note_created`). TASK-045 writes payment creation/confirmation/failure (`payments.created` / `payments.confirmed` / `payments.failed`) without credentials. TASK-063 writes dispute opened (`payments.dispute_opened`) on the linked `payment_adjustment` without rewriting the original payment. TASK-064 writes full refund processed (`payments.refund_processed`) on the linked REFUND PROCESSED adjustment (BR-023/025). TASK-065 writes partial refund processed (`payments.refund_processed` with `partial: true`) on additional REFUND PROCESSED rows with cumulative cap vs original payment. TASK-066 writes chargeback debit/loss (`payments.chargeback_debited`) on linked CHARGEBACK DEBITED/LOST adjustments included in CB/RF (BR-024). TASK-067 writes chargeback won/reversal (`payments.chargeback_won`) on linked REVERSAL WON/REVERSED adjustments that restore net CB/RF impact without editing the debit row (BR-023/024 / E2E-16). TASK-068 writes adjustment note added (`payments.adjustment_note_added`) on linked NOTE OPEN rows and adjustment cancelled (`payments.adjustment_cancelled`) when status becomes CANCELLED (row retained; excluded from financial totals). TASK-047 includes optional `processorFeeAmount` and `actualReceivedAmount` on those payment snapshots; they are reconciliation fields and are not used to rewrite invoice balance. Sensitive keys are masked before persistence. Pino remains operational logging only ([[05 Architecture Decisions#ADR-014 — Logging|ADR-014]]). TASK-076 adds the read-only viewer: `GET /api/audit` with company/actor/entity/action/date filters; `/audit` UI; `audit.read` required; Admin all (including company-null events); Compliance assigned companies only; Staff denied (US-010 — no invented grant). Sensitive values are re-masked on read. No update/delete application APIs.

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

- Compliance review status and notes (`compliance.status_updated`, `compliance.note_added`).
- Compliance report export (`compliance.exported`).
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

- [[02 Current Product Rules]]
- [[Testing]]

> [!danger] Financial immutability
> Confirmed financial transactions must preserve historical values. Corrections use adjustment/reversal workflows rather than silently editing historical records.
> Also see [[Invoices]] · [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Currency and Conversion]] · [[02 Current Product Rules]] · [[Audit Logs]] · [[Testing]]

> [!warning] Payment adjustments
> Refunds, disputes, and chargebacks create linked adjustment records. The original successful payment remains preserved.
> Also see [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Audit Logs]] · [[Dashboard and Reporting]] · [[02 Current Product Rules]] · [[Testing]]
