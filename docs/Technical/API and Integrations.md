---
type: technical
status: approved
tags:
  - technical
  - integration
---

# API and Integrations

> [!important] Accepted HTTP boundary
> Next.js Route Handlers / Server Actions coordinate use cases. They must not contain core domain logic. Identity is Supabase Auth; authorization is application-owned. Payment providers are resolved through the registry in [[05 Architecture Decisions#ADR-008 — Payment provider architecture|ADR-008]] (`verifyWebhook()` is part of the provider contract; implement it in [[TASK-048 Payment Provider Abstraction]], not here).
> See [[02 Architecture]] and [[05 Architecture Decisions#ADR-020 — Next.js server layer|ADR-020]].

> [!abstract] Related
> [[Payments]] · [[Data Model]] · [[Security]] · [[Error Handling]] · [[Deployment]] · [[00 Home]]

```mermaid
flowchart TB
    UI[Web UI] --> API[Versioned REST API]
    API --> Auth[Auth]
    API --> Co[Companies]
    API --> Cust[Customers]
    API --> Inv[Invoices]
    API --> Pay[Payments]
    API --> Fx[Currencies / Rates]
    API --> Comp[Compliance]
    API --> Rep[Reports]
    API --> Audit[Audit]
    Pay --> WH[Signed webhooks]
    WH --> Q[Queue / jobs]
```

The frontend should consume a versioned backend API. Even if the application is server-rendered, business logic should remain in reusable service/domain layers. Suggested endpoint groups are below; exact URLs may vary.

| API Group | Representative Operations |
| --- | --- |
| Auth | POST /api/auth/login, POST /api/auth/logout, POST /api/auth/forgot-password, POST /api/auth/reset-password; GET /auth/callback for Supabase recovery. GET /api/roles requires `user.manage` (TASK-005). optional MFA challenge endpoints later. |
| Companies | GET/POST /api/companies; GET/PATCH /api/companies/{id}. List/create/PATCH require `company.write`. GET by id requires company access (TASK-008). Branding subresource: GET/PATCH /api/companies/{id}/branding; GET/POST/DELETE /api/companies/{id}/branding/logo (TASK-010, `company.write`). Company currencies: GET/PATCH /api/companies/{id}/currencies (TASK-015, `company.write`; reject enabling globally inactive currencies; historically enabled inactive assignments preserved for visibility). Settlement currencies: GET /api/companies/{id}/settlement; PATCH /api/companies/{id}/settlement/{methodCode} (TASK-020, `gateway.credentials.manage`; reject non-enabled settlement currency; no credentials/charges). Reporting groups: GET/POST /api/reporting-groups; GET/PATCH /api/reporting-groups/{id} (TASK-011, `company.write`; membership is not authorization). System settings: GET/PATCH /api/system-settings (TASK-013, `settings.manage`). Currencies: GET/POST /api/currencies; GET/PATCH /api/currencies/{id} (TASK-014, `currency.manage`; soft-disable). New-document selection validation is domain/service-only (`validateCurrencyForNewDocument` / `listCurrenciesForNewDocument`, TASK-021) for later invoice/payment callers — not a public picker API. Fixed conversion rates: GET/POST /api/fixed-conversion-rates (TASK-016/017, `currency.manage`; append-only versions; expire prior ACTIVE on create; no live FX; no historical rate PATCH). Effective selection is domain/service-only (`resolveFixedConversionRate`, TASK-018) for later conversion callers — not a public FX endpoint. Gateway credentials remain TASK-049. |
| Company context | GET/POST /api/company-context (TASK-009 switcher selection). POST /api/company-context/transactional rejects All Companies and cross-company IDOR for company-scoped transactional checks. |
| Customers | GET/POST /api/customers (list/search `q`/`status`/`companyId`, create with `companyIds`; optional `acknowledgeDuplicates`); GET/PATCH /api/customers/{id}; POST /api/customers/{id}/status (soft ACTIVE/INACTIVE); GET/PUT/POST/DELETE /api/customers/{id}/companies; GET /api/customers/{id}/profile; GET /api/customers/{id}/financial-summary; GET /api/customers/{id}/invoices (placeholder); GET /api/customers/{id}/payments (placeholder); GET/POST /api/customers/{id}/notes (internal-only). TASK-023+025+026+027+028+029: `customer.create` / `customer.edit` / `customer.delete` (Admin soft-deactivate only). Create/update may return `409` + `CUSTOMER_DUPLICATE_WARNING` + `duplicates[]` (Admin/Compliance may proceed with ack). Financial summary is by invoice currency (BR-013); live amounts wire when invoice/payment sources exist. Access via `customer_companies`. |
| Invoices | GET/POST /api/invoices; GET/PATCH /api/invoices/{id} (TASK-031 drafts); GET/PUT /api/invoices/{id}/items (TASK-033); POST /api/invoices/{id}/issue; POST /api/invoices/{id}/cancel; POST /api/invoices/{id}/duplicate (TASK-043); GET/POST /api/invoices/{id}/versions; GET/POST /api/invoices/{id}/pdf (TASK-039 generate/list metadata); GET /api/invoices/{id}/pdf/files/{fileId} (TASK-040 preview/download stream; TASK-043 print uses same); GET/POST /api/invoices/{id}/email (TASK-041 send + email_logs; TASK-042 UI + optional cc/bcc). |
| Payments | GET/POST /payments; manual record endpoint; payment detail; refund/adjustment endpoints. |
| Gateways | Create checkout/payment request; provider status; webhook endpoints for Stripe/PayPal/bank processor. |
| Currencies | GET/POST/PATCH currencies; fixed-rates endpoint; company-enabled currency endpoint. |
| Compliance | Queues, review detail, status update, notes. |
| Reports | Parameterized report endpoints with pagination and export jobs/files. |
| Audit | Append-only application writes via domain/service (TASK-012). Read-only filter endpoint for authorized roles remains TASK-076. No update/delete audit APIs. |
| Users | GET/POST /api/users; GET/PATCH /api/users/{id}; POST /api/users/{id}/suspend; POST /api/users/{id}/reset-password (TASK-006, Admin/`user.manage` only). PATCH/create persist `companyIds` (TASK-008). |


### 18.1 Webhook Requirements

- Dedicated webhook URL per provider or provider type.

- Validate webhook signatures using provider secrets.

- Store external event IDs and enforce unique processing for idempotency.

- Respond quickly; move heavy post-processing to queue/jobs if architecture supports it.

- Log processing result and correlation ID without logging sensitive secrets/card data.

- Support event retries safely.

### 18.2 Payment Provider Adapter Interface

| createPaymentRequest(invoice, settlementCurrency, convertedAmount) getPaymentStatus(externalTransactionId) parseWebhook(payload, headers) getFees(transaction)  # optional reconciliation only refundPayment(transaction, amount)  # if supported healthCheck() |
| --- |

Accepted architecture also requires `verifyWebhook()`, a provider registry, and capability flags. Implement the TypeScript contract in [[TASK-048 Payment Provider Abstraction]]. Do not hardcode provider names in core domain logic. See [[05 Architecture Decisions#ADR-008 — Payment provider architecture|ADR-008]].


## Related Documentation

### Depends On

- [[Security]]
- [[Data Model]]

### Integrates With

- [[Payments]]
- [[Error Handling]]
- [[Deployment]]

### Technical

- [[Testing]]
- [[02 Architecture]]

> [!warning] Company isolation
> Every company-scoped operation must enforce company access **server-side**. Frontend hiding is not authorization.
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[Business Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]
