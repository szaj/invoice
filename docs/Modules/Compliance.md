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
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[Business Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]
