---
type: module
status: approved
phase: 3
domain: customers
tags:
  - module
---

# Customers

> [!abstract] Related
> [[Companies and Brands]] · [[Invoices]] · [[Payments]] · [[Compliance]] · [[Data Model]] · [[00 Home]]

### 7.1 Customer Fields

| Category | Fields |
| --- | --- |
| Identity | Customer ID, Customer/Company Name, Contact Person, Customer Type (Individual/Business). |
| Contact | Email, Phone, Alternate Phone (optional). |
| Address | Billing Address 1/2, City, State/Region, Postal Code, Country. |
| Business | Tax/VAT/EIN/Registration ID (optional), website (optional). |
| Preferences | Default invoice currency, default company/brand (optional), payment preference (optional). |
| Internal | Status, assigned staff, internal notes, tags, created by/date, updated by/date. |


### 7.2 Customer Profile Page

Each customer profile must provide a consolidated operational view. When the customer transacts with multiple brands, the user can filter the profile by company or view all authorized companies.

| Profile Area | Requirements |
| --- | --- |
| Financial Summary | Total Invoiced, Total Paid, Outstanding, Overdue. Show currency-aware values; do not add mixed currencies without conversion. |
| Invoices | Invoice number, company, date, due date, invoice currency, amount, paid, balance, status. |
| Payments | Payment date, invoice, method, invoice-currency applied amount, settlement currency, fixed-rate converted amount, optional merchant fee, optional actual received amount, status. |
| Notes | Internal-only notes with author and timestamp. |
| Activity | Relevant audit entries such as creation, edits, invoice sends, payments, compliance events. |


### 7.3 Customer Rules

- Customer email is not required to create a draft but is required to email an invoice.

- Duplicate detection should warn on same email, phone, or company/customer name; Admin/Compliance may proceed if appropriate.

- Customer deactivation should block new invoices while preserving history.

- A customer may be linked to multiple companies without duplicating the customer master record, subject to tenant access policies.


## Related Documentation

### Depends On

- [[Companies and Brands]]
- [[Roles and Permissions]]

### Integrates With

- [[Invoices]]
- [[Payments]]
- [[Compliance]]

### Technical

- [[Data Model]]
- [[Business Rules]]
- [[Testing]]
