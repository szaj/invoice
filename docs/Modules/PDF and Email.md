---
type: module
status: approved
phase: 4
domain: invoicing
tags:
  - module
---

# PDF and Email

> [!abstract] Related
> [[Invoices]] · [[Notifications]] · [[Settings]] · [[Deployment]] · [[00 Home]]

### 9.1 PDF Requirements

- Company logo and legal/display information.

- Invoice number, dates, customer billing details.

- Line items, subtotal, discounts, tax, total, paid amount, balance due.

- Invoice currency clearly displayed.

- Brand-specific terms and payment instructions.

- Professional A4/Letter-compatible layout with consistent print rendering.

- PDF generated server-side and stored as a versioned document linked to the invoice.

- Historical PDF versions must remain retrievable if an invoice is revised.

### 9.2 Email Invoice

- Sender identity and reply-to should be configured per company where supported.

- Recipient defaults to customer email and may allow additional CC/BCC subject to permissions.

- Subject/body generated from company template with merge fields.

- PDF attached.

- Optional payment link(s) can be included. These links lead to hosted payment checkout, not a customer account portal.

- System records recipient, subject, sender user, timestamp, delivery request status, and provider message ID where available.


## Related Documentation

### Depends On

- [[Invoices]]
- [[Companies and Brands]]

### Integrates With

- [[Notifications]]
- [[Settings]]
- [[Payments]]

### Technical

- [[Deployment]]
- [[Error Handling]]
- [[Testing]]
