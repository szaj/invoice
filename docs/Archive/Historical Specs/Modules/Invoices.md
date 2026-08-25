---
type: module
status: approved
phase: 4
domain: invoicing
tags:
  - module
  - finance
---

# Invoices

> [!abstract] Related
> [[Customers]] · [[Companies and Brands]] · [[PDF and Email]] · [[Payments]] · [[Currency and Conversion]] · [[Compliance]] · [[Business Rules]] · [[00 Home]]

TASK-030 persists the invoice **header** on `invoices` (Invoices §8.2): mandatory company + customer (BR-001), invoice/due dates, currency code, optional reference/PO, assigned staff, compliance status placeholder, internal notes (never printed/emailed), customer notes. Default status `DRAFT`. `invoice_number` nullable until TASK-035.

TASK-031 exposes draft CRUD via `GET/POST /api/invoices` and `GET/PATCH /api/invoices/{id}`: company-scoped access, customer must be linked and ACTIVE for new drafts, currency must be company-enabled and globally ACTIVE (BR-002). Assigned staff defaults to creator. Staff may edit only own/assigned drafts. No issue/send, line items, totals, numbering, or PDF.

TASK-032 adds draft UI: `/invoices` list/filter (company-scoped), `/invoices/new`, `/invoices/{id}` view, `/invoices/{id}/edit`. Internal notes are labeled internal-only (never customer-visible). Totals are display-only placeholders until TASK-034. PDF/email/payment actions are omitted.

TASK-033 adds `invoice_items`: description, quantity (> 0, default 1), unit rate, optional tax name/rate snapshot, server-calculated `line_total = round(qty × rate)`. Nested replace on drafts only (`PUT /api/invoices/{id}/items`). Discount omitted while ADR-010 is OPEN. Invoice-level subtotal/tax/total remain TASK-034.

TASK-034 stores and recalculates invoice totals on the header: subtotal, discount_total (always 0 while ADR-010 OPEN), tax_total (from line tax snapshots), invoice_total, confirmed_paid_amount, outstanding_amount (BR-009; paid applications empty until payments). Totals panel is display-only. Recalculation runs when draft line items are replaced.

TASK-035 allocates invoice numbers from company branding prefix + per-company `invoice_sequence_next` (transactional, never reused). Optional year segment via `system_settings.invoice_number_include_year`. Drafts remain unnumbered until assign/issue. Client hand-edits rejected. Unique within company only.

TASK-036 issues drafts (`POST /api/invoices/{id}/issue`): allocates number if null, sets status ISSUED, audits `invoices.issued`. Overdue (BR-018) evaluated on list/detail load. Status filters on `/invoices`. TASK-038 soft-cancels Draft/Issued/Overdue (`POST /api/invoices/{id}/cancel`) with mandatory reason; audits `invoices.cancelled`; excludes cancelled from collectible outstanding (BR-019). TASK-039 generates branded PDFs (`POST /api/invoices/{id}/pdf`) from invoice version snapshots via React-pdf; stores metadata in `invoice_files` and bytes in StorageService; one PDF per version; internal notes never printed. TASK-040 adds preview/download on `/invoices/{id}` and `GET /api/invoices/{id}/pdf/files/{fileId}` (inline/attachment); Staff denied for unassigned invoices (403). TASK-043 duplicates any viewable invoice into a new Draft (`POST /api/invoices/{id}/duplicate`): copies commercial header fields + line items; resets number/status/payments/versions/PDFs/emails/cancellation; audits `invoices.duplicated`. Print/export uses the stored versioned PDF (no second renderer). Paid/partial require payment records. Issued financial edits blocked while ADR-009 OPEN. Due date remains mandatory (US-011 undecided).

TASK-037 creates immutable `invoice_versions` on issue (snapshot of header/lines/totals). Version history on invoice view. Issued financial PATCH rejected. Non-financial metadata may be edited by Admin/Compliance (`invoice.edit_issued`) with audit; Staff cannot. ADR-009 remains OPEN — no financial revision workflow.

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Issued: Issue / Send
    Draft --> Cancelled
    Issued --> PartiallyPaid: First confirmed payment
    Issued --> Paid: Full payment
    Issued --> Overdue: Due date passed
    Issued --> Cancelled: Reason required
    PartiallyPaid --> Paid: Balance cleared
    PartiallyPaid --> Overdue: Due date passed
    Overdue --> PartiallyPaid: Partial collection
    Overdue --> Paid: Balance cleared
    Overdue --> Cancelled
```

### 8.1 Invoice Lifecycle

| From | To |
| --- | --- |
| Draft | Issued/Sent, Cancelled |
| Issued/Sent | Partially Paid, Paid, Overdue, Cancelled |
| Partially Paid | Paid, Overdue |
| Overdue | Partially Paid, Paid, Cancelled |


### 8.2 Invoice Header Fields

| Field | Requirement |
| --- | --- |
| Company | Mandatory; defines branding, numbering, currencies, payment modes. |
| Invoice Number | System-generated using company prefix/sequence; unique within company. |
| Customer | Mandatory. |
| Invoice Date | Mandatory. |
| Due Date | Mandatory unless company policy allows due-on-receipt. |
| Currency | Must be enabled for selected company. |
| Reference / PO | Optional. |
| Assigned Staff | Defaults to creator; editable by authorized roles. |
| Compliance Status | Not Reviewed / Under Review / Approved / Flagged. |
| Internal Notes | Never printed or emailed. |
| Customer Notes | Optional invoice-visible notes. |


### 8.3 Invoice Line Items

| Field | Type / Rule |
| --- | --- |
| Description | Text, required. |
| Quantity | Decimal > 0; default 1. |
| Unit Rate | Money in invoice currency. |
| Discount | Optional line or invoice level; percentage or fixed, implementation should choose one consistent model or support both explicitly. |
| Tax | Optional percentage; tax name/rate stored as snapshot. |
| Line Total | Calculated. |


### 8.4 Invoice Totals

- Subtotal

- Discount total

- Tax total

- Invoice total

- Confirmed paid amount in invoice currency

- Outstanding balance in invoice currency

### 8.5 Invoice Actions

| Action | Behavior |
| --- | --- |
| Save Draft | Editable financial fields; no customer communication. |
| Issue | Assign/finalize invoice number if numbering is delayed until issue; lock key fields according to policy. |
| Generate PDF | Generate immutable snapshot or versioned PDF. |
| Email Invoice | Attach PDF and optionally include hosted gateway payment link(s), without providing a customer portal. |
| Record Payment | Create payment against invoice; support partial payments. |
| Cancel Invoice | Status change with mandatory reason; history retained. |
| Duplicate | Create new Draft with copied line items and new invoice ID/number rules. |
| Export/Print | Download PDF / browser print. |


### 8.6 Editing Issued Invoices

Issued financial documents should not be silently altered. Recommended behavior: minor non-financial metadata may be edited with audit history; financial changes require either (a) a controlled revised invoice version with reason, or (b) cancellation and reissue. The final implementation decision should be consistent across all companies.


## Related Documentation

### Depends On

- [[Companies and Brands]]
- [[Customers]]
- [[Currency and Conversion]]
- [[Roles and Permissions]]
- [[Business Rules]]

### Integrates With

- [[PDF and Email]]
- [[Payments]]
- [[Compliance]]
- [[Audit Logs]]
- [[Dashboard and Reporting]]

### Technical

- [[Data Model]]
- [[API and Integrations]]
- [[Security]]
- [[Testing]]

> [!danger] Financial immutability
> Confirmed financial transactions must preserve historical values. Corrections use adjustment/reversal workflows rather than silently editing historical records.
> Also see [[Invoices]] · [[Payments]] · [[Refunds Disputes Chargebacks]] · [[Currency and Conversion]] · [[Business Rules]] · [[Audit Logs]] · [[Testing]]

> [!warning] Company isolation
> Every company-scoped operation must enforce company access **server-side**. Frontend hiding is not authorization.
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[Business Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]
