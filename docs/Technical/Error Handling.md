---
type: technical
status: approved
tags:
  - technical
---

# Error Handling

> [!abstract] Related
> [[Payments]] · [[Currency and Conversion]] · [[API and Integrations]] · [[Security]] · [[00 Home]]

| Scenario | Required Behavior |
| --- | --- |
| Fixed conversion rate missing | Block the cross-currency payment/conversion and show a clear Admin configuration message. Never fetch, guess, or substitute a market/gateway rate. TASK-018 `resolveFixedConversionRate` returns `FIXED_RATE_MISSING_FOR_CONVERSION` when no Admin version covers `at`. TASK-046 also blocks cross-currency confirm when the snapshot is incomplete and no Admin rate exists at `payment_date`. |
| Gateway timeout | Keep payment Pending/Unknown; reconcile via webhook/status check; do not mark Paid optimistically. |
| Duplicate webhook | Recognize event ID and process idempotently. |
| Email failure | Invoice remains issued; email log marked Failed with retry action. |
| PDF generation failure | Show generation error; do not claim email sent with missing attachment. |
| Permission failure | Return 403; log high-risk attempts where appropriate. |
| Concurrent invoice update | Use optimistic locking/version checks or equivalent to prevent silent overwrite. |
| Invalid company context | Reject request server-side (TASK-009: inaccessible/malformed selection → reject; All Companies on transactional action → 400; company_id mismatch / IDOR → 403). |
| Illegal payment status transition | Reject confirm/fail when the payment is not PENDING (TASK-045). SUCCESSFUL financial fields stay locked (BR-005). |
| Currency disabled after invoice | Historical invoice remains valid; no impact on existing data. TASK-021 `resolveCurrencyForHistoricalDisplay` still returns catalog metadata for INACTIVE codes; `validateCurrencyForNewDocument` rejects the same code for new selection. |
| Gateway disabled after payment | Historical payments remain visible. |


## Related Documentation

### Depends On

- [[Payments]]
- [[Currency and Conversion]]

### Integrates With

- [[API and Integrations]]
- [[Security]]

### Technical

- [[Testing]]

> [!danger] Fixed conversion rates
> Rates are Admin-defined and versioned. Historical payments retain the exact rate snapshot used. Changing a rate affects future transactions only. Never fetch, guess, or substitute a market/gateway rate.
> Also see [[Currency and Conversion]] · [[Payments]] · [[Business Rules]] · [[Data Model]] · [[Dashboard and Reporting]] · [[Testing]]

> [!warning] Company isolation
> Every company-scoped operation must enforce company access **server-side**. Frontend hiding is not authorization.
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[Business Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]
