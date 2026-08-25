---
type: reference
status: approved
tags:
  - product
---

# Product Goals

> [!abstract] Related
> [[Product Overview]] · [[Out of Scope]] · [[Deployment]] · [[00 Home]]

### 2.1 In-Scope Modules

| Module | Version 1 Requirement |
| --- | --- |
| Authentication & Users | Secure login, password reset, role assignment, company assignment, session controls. |
| Companies / Brands | Create, edit, activate/deactivate companies; brand-specific invoice, currency, email, and payment configuration. |
| Customers | Create, edit, search, view financial profile, invoice history, payment history, notes, status. |
| Invoices | Draft, issue, send, PDF, partial payment support, overdue logic, cancellation, immutable financial history. |
| Currencies | USD, AED, PKR, GBP, AUD by default; Admin may add/disable currencies and manage fixed conversion rates. |
| Payments | Stripe, PayPal, bank/card processor abstraction, manual payments, settlement conversion using fixed Admin rates, partial payments, and refunds/adjustments where supported. Merchant fees are optional reconciliation data only. |
| Compliance | Review queue, approve/flag, internal notes, evidence/attachment references, audit visibility. |
| Reporting | Invoices, payments, customers, outstanding, company performance, staff, gateways, currency, optional merchant-fee reconciliation, compliance. |
| Audit Logs | Create/update/send/payment/status/login/admin actions; append-only behavior. |
| Settings | Company settings, currencies, fixed conversion rates, gateways, email templates, invoice numbering, system controls. |


### 2.2 Explicitly Out of Scope for Version 1

- Customer login portal or customer account dashboard.

- General ledger / double-entry accounting.

- Expense management and vendor bills.

- Inventory / stock management.

- Payroll.

- Purchase orders.

- Tax filing or statutory accounting submissions.

- Automated debt collection beyond email reminders.

- Native mobile apps.


## Related Documentation

### Depends On

- [[Product Overview]]

### Integrates With

- [[Out of Scope]]
- [[03 Implementation Plan]]

### Technical

- [[Deployment]]
