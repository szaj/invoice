---
type: module
status: approved
phase: 7
domain: notifications
tags:
  - module
---

# Notifications

> [!abstract] Related
> [[PDF and Email]] · [[Settings]] · [[Invoices]] · [[Payments]] · [[00 Home]]

- Invoice email sent successfully / failed.

- Payment successful / failed (internal notification optional).

- Invoice overdue notification to assigned staff/admin (configurable).

- Compliance flagged item notification.

- Gateway configuration/webhook failure alert to Admin.

- No customer portal notifications in Version 1.

### 14.1 Email Template Merge Fields

| {{company_name}} {{customer_name}} {{invoice_number}} {{invoice_date}} {{due_date}} {{invoice_currency}} {{invoice_total}} {{amount_paid}} {{balance_due}} {{payment_link}}  (optional) {{company_email}} {{company_phone}} |
| --- |


## Related Documentation

### Depends On

- [[PDF and Email]]
- [[Settings]]

### Integrates With

- [[Invoices]]
- [[Payments]]
- [[Compliance]]

### Technical

- [[Error Handling]]
