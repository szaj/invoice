---
type: technical
status: approved
tags:
  - technical
  - security
---

# Authorization

Application RBAC for TASK-005, Admin user management for TASK-006, Admin company CRUD for TASK-007, user-company assignments for TASK-008, tenant isolation / company context for TASK-009, Admin company branding for TASK-010, and Admin reporting groups for TASK-011. Identity remains Supabase Auth. See [[05 Architecture Decisions#ADR-003 — Authentication|ADR-003]], [[Roles and Permissions]], and [[Authentication]].

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