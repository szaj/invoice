---
type: foundation
status: approved
tags:
  - module
  - security
---

# Roles and Permissions

> [!abstract] Related
> [[Companies and Brands]] · [[Security]] · [[Audit Logs]] · [[Settings]] · [[Screen Inventory]] · [[00 Home]]

Role-Based Access Control (RBAC) is mandatory. Permissions should also be constrained by company assignment. An Admin may access all companies; Compliance and Staff can be assigned to specific companies.

| Permission | Admin | Compliance | Staff |
| --- | --- | --- | --- |
| View dashboard | Yes | Yes | Yes, assigned scope |
| Create/edit company | Yes | No | No |
| Manage gateway credentials | Yes | No | No |
| Create customer | Yes | Yes | Yes |
| Edit customer | Yes | Yes | Limited / assigned |
| Delete customer | Restricted* | No | No |
| Create invoice | Yes | Yes | Yes |
| Edit draft invoice | Yes | Yes | Yes, own/assigned |
| Edit issued invoice | Controlled | Controlled | No |
| Cancel invoice | Yes | Recommend Yes | No |
| Delete invoice | No hard delete | No | No |
| Record manual payment | Yes | Yes | Optional permission |
| Modify confirmed payment | Adjustment workflow | Adjustment workflow | No |
| View all assigned invoices | Yes | Yes | Optional by policy |
| Reports | All | Assigned | Limited |
| Export reports | Yes | Yes | Optional |
| Compliance review | Yes | Yes | No |
| Audit logs | All | Assigned | Own activity only/none |
| Manage users | Yes | No | No |
| Manage currencies/rates | Yes | No | No |
| Manage system settings | Yes | No | No |


*Customer deletion should normally be a soft-delete/deactivation only if financial records exist. Financial records must never be hard-deleted through the UI.

### 4.1 User Account Fields

- Full name

- Email / username

- Role

- Assigned companies

- Status: Active / Suspended

- Optional employee ID

- Last login date/time

- Created by / created date

- Password reset required flag

- Optional MFA status


## Related Documentation

### Depends On

- [[Companies and Brands]]

### Integrates With

- [[Settings]]
- [[Audit Logs]]
- [[Screen Inventory]]

### Technical

- [[Security]]
- [[Business Rules]]
- [[Testing]]
- [[API and Integrations]]
- [[Data Model]]

> [!warning] Company isolation
> Every company-scoped operation must enforce company access **server-side**. Frontend hiding is not authorization.
> Also see [[Roles and Permissions]] · [[Companies and Brands]] · [[Business Rules]] · [[Security]] · [[Data Model]] · [[API and Integrations]] · [[Testing]]
