export const PERMISSION_CODES = [
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
  "invoice.delete",
  "payment.manual.record",
  "payment.adjust",
  "invoice.view_assigned",
  "report.view",
  "report.export",
  "compliance.review",
  "audit.read",
  "user.manage",
  "currency.manage",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const PERMISSION_DEFINITIONS: Record<
  PermissionCode,
  { code: PermissionCode; name: string }
> = {
  "dashboard.view": { code: "dashboard.view", name: "View dashboard" },
  "company.write": { code: "company.write", name: "Create/edit company" },
  "gateway.credentials.manage": {
    code: "gateway.credentials.manage",
    name: "Manage gateway credentials",
  },
  "customer.create": { code: "customer.create", name: "Create customer" },
  "customer.edit": { code: "customer.edit", name: "Edit customer" },
  "customer.delete": { code: "customer.delete", name: "Delete customer (soft-delete)" },
  "invoice.create": { code: "invoice.create", name: "Create invoice" },
  "invoice.edit_draft": { code: "invoice.edit_draft", name: "Edit draft invoice" },
  "invoice.edit_issued": { code: "invoice.edit_issued", name: "Edit issued invoice (controlled)" },
  "invoice.cancel": { code: "invoice.cancel", name: "Cancel invoice" },
  "invoice.delete": { code: "invoice.delete", name: "Hard-delete invoice" },
  "payment.manual.record": { code: "payment.manual.record", name: "Record manual payment" },
  "payment.adjust": {
    code: "payment.adjust",
    name: "Modify confirmed payment via adjustment workflow",
  },
  "invoice.view_assigned": { code: "invoice.view_assigned", name: "View all assigned invoices" },
  "report.view": { code: "report.view", name: "View reports" },
  "report.export": { code: "report.export", name: "Export reports" },
  "compliance.review": { code: "compliance.review", name: "Compliance review" },
  "audit.read": { code: "audit.read", name: "Read audit logs" },
  "user.manage": { code: "user.manage", name: "Manage users" },
  "currency.manage": { code: "currency.manage", name: "Manage currencies/rates" },
};

export function isPermissionCode(value: string | null | undefined): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value ?? "");
}

export const HIGH_RISK_PERMISSIONS = new Set<PermissionCode>([
  "company.write",
  "gateway.credentials.manage",
  "user.manage",
  "currency.manage",
  "customer.delete",
  "payment.adjust",
]);
