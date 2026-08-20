import type { PermissionCode } from "@/domain/authz/permissions";
import type { RoleCode } from "@/domain/authz/roles";

/**
 * Version 1 permission matrix from Roles and Permissions.
 *
 * Optional Staff policies from Unresolved Source Items are omitted on purpose
 * (denied). Do not invent those grants here.
 */
const ADMIN_PERMISSIONS: readonly PermissionCode[] = [
  "dashboard.view",
  "company.write",
  "gateway.credentials.manage",
  "customer.create",
  "customer.edit",
  "customer.delete",
  "invoice.create",
  "invoice.edit_draft",
  "invoice.edit_issued",
  "invoice.cancel",
  "payment.manual.record",
  "payment.adjust",
  "invoice.view_assigned",
  "report.view",
  "report.export",
  "compliance.review",
  "audit.read",
  "user.manage",
  "currency.manage",
  "settings.manage",
];

const COMPLIANCE_PERMISSIONS: readonly PermissionCode[] = [
  "dashboard.view",
  "customer.create",
  "customer.edit",
  "invoice.create",
  "invoice.edit_draft",
  "invoice.edit_issued",
  "invoice.cancel",
  "payment.manual.record",
  "payment.adjust",
  "invoice.view_assigned",
  "report.view",
  "report.export",
  "compliance.review",
  "audit.read",
];

const STAFF_PERMISSIONS: readonly PermissionCode[] = [
  "dashboard.view",
  "customer.create",
  "customer.edit",
  "invoice.create",
  "invoice.edit_draft",
  "report.view",
];

export const ROLE_PERMISSIONS: Record<RoleCode, ReadonlySet<PermissionCode>> = {
  ADMIN: new Set(ADMIN_PERMISSIONS),
  COMPLIANCE: new Set(COMPLIANCE_PERMISSIONS),
  STAFF: new Set(STAFF_PERMISSIONS),
};

export const OPEN_STAFF_POLICIES = [
  {
    id: "US-007",
    permission: "payment.manual.record",
    source: "Staff manual payment: Optional permission",
    grant: false,
  },
  {
    id: "US-008",
    permission: "invoice.view_assigned",
    source: "Staff view of assigned invoices: Optional by policy",
    grant: false,
  },
  {
    id: "US-009",
    permission: "report.export",
    source: "Staff report export: Optional",
    grant: false,
  },
  {
    id: "US-010",
    permission: "audit.read",
    source: "Staff audit visibility: Own activity only/none",
    grant: false,
  },
] as const satisfies ReadonlyArray<{
  id: string;
  permission: PermissionCode;
  source: string;
  grant: false;
}>;

export function permissionsForRole(role: RoleCode): ReadonlySet<PermissionCode> {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: RoleCode, permission: PermissionCode): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
