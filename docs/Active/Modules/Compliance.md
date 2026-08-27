---
type: module
status: approved
phase: 7
domain: compliance
tags:
  - module
  - security
---

# Compliance

> [!abstract] Related
> [[Roles and Permissions]] · [[Invoices]] · [[Payments]] · [[Audit Logs]] · [[Dashboard and Reporting]] · [[00 Home]]

### 11.1 Compliance Statuses

| Status | Meaning |
| --- | --- |
| Not Reviewed | No compliance review started. |
| Under Review | Review in progress. |
| Approved | Review completed with no unresolved issue. |
| Flagged | Requires attention/correction/investigation. |


### 11.2 Compliance Capabilities

- View customer, invoice, payment, email history, and audit data for assigned companies.

- Add internal compliance notes.

- Approve or flag an invoice/payment/customer record.

- Record reason codes and resolution notes.

- Filter queues by company, staff, date, amount, gateway, currency, and status.

- Export compliance report if permission is granted.

- No deletion or manipulation of audit logs.

### Implementation (TASK-071 / TASK-072 / TASK-073 / TASK-074 / TASK-075)

- Shared `compliance_status` on invoices, payments, and customers: Not Reviewed / Under Review / Approved / Flagged.
- `compliance_reviews` rows on status change include optional notes, reason codes, resolution notes, and evidence refs.
- `POST /api/compliance/status` accepts notes/reason/resolutionNotes/evidenceRefs on approve/flag.
- `POST /api/compliance/notes` adds notes without changing status; `GET /api/compliance/notes` lists review history for a subject.
- Status and notes require `compliance.review` (Admin/Compliance). Staff receives 403.
- Detail pages display compliance status; Staff cannot change it via invoice draft/metadata forms.
- Review queue: `GET /api/compliance/queue` with company/staff/date/amount/gateway/currency/status filters; Compliance assigned companies only; Admin all.
- Review UI (TASK-074): `/compliance` queue + `/compliance/{subjectType}/{subjectId}` detail with approve/flag/notes; Staff denied; nav gated by `compliance.review`.
- Export (TASK-075): `GET /api/compliance/export` CSV of the filtered queue; requires `report.export` and `compliance.review`; Staff denied (US-009); audited as `compliance.exported`; Export CSV on `/compliance` when export is allowed.


## Related Documentation

### Depends On

- [[Roles and Permissions]]
- [[Companies and Brands]]

### Integrates With

- [[Invoices]]
- [[Payments]]
- [[Customers]]
- [[Audit Logs]]
- [[Dashboard and Reporting]]

### Technical

- [[Testing]]
- [[Security]]

> [!warning] Company isolation
> Every company-scoped operation must enforce company access **server-side**. Frontend hiding is not authorization.
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[02 Current Product Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]
