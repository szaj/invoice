---
type: technical
status: approved
tags:
  - technical
  - security
---

# Authorization

Application RBAC for TASK-005 through TASK-020 (including Admin system settings, currency master, company currencies, fixed conversion rate versions, and settlement currency configuration). Identity remains Supabase Auth. See [[05 Architecture Decisions#ADR-003 — Authentication|ADR-003]], [[Roles and Permissions]], and [[Authentication]].

## Boundary

```text
authenticated ≠ authorized
```

Supabase Auth answers who the identity is. The application database/domain answers what that user may do.

Do **not** read roles, permissions, or company access from Auth `user_metadata`, `app_metadata`, JWT claims, or custom claims.

[[TASK-008 User Company Assignments]] stores `user_companies` in the application database. Admin (`ALL`) may access every company without assignment rows. Compliance and Staff (`ASSIGNED`) may access only assigned company IDs. Reporting-group membership is not authorization.

[[TASK-009 Tenant Isolation and Company Context]] adds per-request company context (httpOnly cookie `app-company-context`) and the authenticated-layout header switcher. Admin may select **All Companies** for consolidated reporting only. Transactional company-scoped actions require one concrete company (`requireConcreteCompanyId` / `assertTransactionalCompanyScope`). Changing context revalidates the app layout. Frontend hiding is not authorization.

[[TASK-007 Company CRUD]] stores company identity records. Company list/create/edit/activate/deactivate require `company.write` (Admin). `GET /api/companies/{id}` requires company access (`assertCompanyAccess`): unassigned Compliance/Staff → 403.

[[TASK-010 Company Branding Configuration]] stores invoice branding (prefix, terms, email template reference, brand contact, logo metadata) under the same `company.write` gate. Staff/Compliance cannot mutate branding.

[[TASK-011 Reporting Groups]] stores optional `company_groups` and `companies.reporting_group_id` for consolidated report roll-ups. Admin manages groups under `company.write`. Membership never bypasses `user_companies` / `assertCompanyAccess`.

[[TASK-013 Core System Settings]] stores singleton `system_settings` (reporting currency code, default timezone, rounding tolerance placeholder). Read/update require `settings.manage` (Admin). Updates are audited. ADR-011 remains OPEN.

[[TASK-014 Currency Master]] stores global `currencies` (code, name, symbol, decimal precision, ACTIVE/INACTIVE). Admin manages under `currency.manage`. Soft-disable only (BR-011).

[[TASK-015 Company Currency Configuration]] stores `company_currencies` (enabled subset + default invoice currency). Admin manages under `company.write`. Enabling a globally INACTIVE currency is rejected (BR-002).

[[TASK-016 Fixed Conversion Rate Schema]] stores Admin-defined `fixed_conversion_rates` under `currency.manage`. Create-only; never market/gateway FX.

[[TASK-017 Fixed Rate Versioning]] creates append-only versions: prior ACTIVE rows for the pair are expired/closed and retained; no PATCH of historical `fixed_rate`. Version history list under `/settings/fixed-rates`.

[[TASK-018 Effective Rate Selection]] provides `resolveFixedConversionRate` for later conversion paths (read model over `valid_from`/`valid_to`; same-currency 1; missing blocks). Not an Admin-only gate — callers enforce their own authorization.

[[TASK-020 Settlement Currency Configuration]] stores method enablement and settlement currencies on `payment_gateway_configs` / `payment_gateway_settlement_currencies`. Admin manages under `gateway.credentials.manage`. Non-enabled settlement currencies are rejected (BR-006). Credentials/charges are not included.
## Roles

| Code | Name | Company scope capability |
| --- | --- | --- |
| `ADMIN` | Admin | All companies |
| `COMPLIANCE` | Compliance | Assigned companies |
| `STAFF` | Staff | Assigned companies |

`users.role_id` is assigned by Admin user management ([[TASK-006 User Management]]). A user with no role is authenticated and authorized for nothing.

For a brand-new environment, the first Admin is assigned by the operational CLI `pnpm bootstrap:admin -- --email <existing-user@example.com>` (see [[Authentication]]). That CLI writes only `users.role_id` in the application database. It is not a runtime authorization bypass and must not be used for routine role changes.

Suspended application users are denied every permission and cannot use the authenticated app shell. Login also rejects suspended users after Supabase Auth succeeds.

## Permissions

The Version 1 matrix in [[Roles and Permissions]] is encoded in `src/domain/authz/matrix.ts` and seeded into `roles` / `permissions` / `role_permissions`.

Hard-delete of invoices is denied for every role. Customer `customer.delete` is Admin-only and means soft-delete/deactivation; `canHardDeleteCustomer()` is always false.

## Open Staff policies (denied)

These remain unresolved. TASK-005/TASK-006 do **not** invent grants:

| ID | Permission | Source wording |
| --- | --- | --- |
| US-007 | `payment.manual.record` | Optional permission |
| US-008 | `invoice.view_assigned` | Optional by policy |
| US-009 | `report.export` | Optional |
| US-010 | `audit.read` | Own activity only/none |

Issued-invoice financial edit *workflow* remains [[05 Architecture Decisions#ADR-009 — Issued invoice financial edit policy|ADR-009]] OPEN. Admin and Compliance have `invoice.edit_issued` as a capability to enter that controlled workflow later. Staff does not.

## Enforcement

```text
assertPermission(principal, permission)
assertCompanyAccess(principal, companyId)
```

- Unauthenticated: HTTP 401
- Suspended, missing role, or denied: HTTP 403 with a generic message
- Frontend hiding is not authorization

Representative protected actions:

- `GET /api/roles` requires `user.manage` (Admin only). Lists the role catalog.
- User management routes and Server Actions under `/users` and `/api/users` require `user.manage`. Non-Admin → 403.
- Company CRUD list/create/PATCH/status under `/companies` and `/api/companies` require `company.write`. Non-Admin → 403. There is no DELETE; deactivate sets status `INACTIVE`.
- Company branding GET/PATCH and logo GET/POST/DELETE under `/api/companies/{id}/branding` require `company.write`. Non-Admin → 403.
- Reporting groups GET/POST/PATCH under `/settings/reporting-groups` and `/api/reporting-groups` require `company.write`. Non-Admin → 403. Membership is not authorization.
- System settings GET/PATCH under `/settings/system` and `/api/system-settings` require `settings.manage`. Non-Admin → 403.
- Currencies GET/POST/PATCH under `/settings/currencies` and `/api/currencies` require `currency.manage`. Non-Admin → 403. Soft-disable only.
- Company currencies GET/PATCH under `/companies/{id}/currencies` and `/api/companies/{id}/currencies` require `company.write`. Non-Admin → 403. Globally inactive currencies cannot be enabled.
- Settlement currencies GET under `/companies/{id}/settlement` and `/api/companies/{id}/settlement`, and PATCH `/api/companies/{id}/settlement/{methodCode}`, require `gateway.credentials.manage`. Non-Admin → 403. Non-enabled settlement currencies are rejected (BR-006). No credentials or live charges.
- Fixed conversion rates GET/POST under `/settings/fixed-rates` and `/api/fixed-conversion-rates` require `currency.manage`. Non-Admin → 403. No market/gateway FX substitution. No PATCH of historical rate amounts; new versions expire prior ACTIVE rows.
- `GET /api/companies/{id}` requires company access. Admin ALL; Compliance/Staff assigned only. Unassigned → 403.
- User create/PATCH persist `companyIds` under `user.manage`. Assignments are not read from Auth metadata.
- `GET/POST /api/company-context` manage the selected company context. Staff/Compliance cannot select All Companies or unassigned IDs.
- `POST /api/company-context/transactional` rejects All Companies context and cross-company IDOR (representative gate for later transactional modules).

`password_reset_required` is not checked as a permission. It only drives session/workflow redirects after authentication.

Financial modules (customers, invoices, payments) must reuse the same concrete-company context enforcement when implemented.

## Related

- [[Authentication]]
- [[Security]]
- [[Roles and Permissions]]
- [[Business Rules]] BR-016
- [[TASK-005 Roles and Permissions Model]]
- [[TASK-006 User Management]]
- [[TASK-007 Company CRUD]]
- [[TASK-008 User Company Assignments]]
- [[TASK-009 Tenant Isolation and Company Context]]
- [[TASK-010 Company Branding Configuration]]
- [[TASK-011 Reporting Groups]]