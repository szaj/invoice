import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { companyScopeForRole } from "@/domain/authz/company-access";
import type { InvoiceRecord } from "@/domain/invoices/types";

/**
 * Staff may edit a draft only when they created it or are assigned (Roles and Permissions).
 * Admin/Compliance may edit any draft in an accessible company (caller enforces company access).
 */
export function canStaffEditDraftInvoice(
  actor: AuthorizationPrincipal,
  invoice: Pick<InvoiceRecord, "createdByUserId" | "assignedStaffUserId" | "status">,
): boolean {
  if (invoice.status !== "DRAFT") {
    return false;
  }
  if (actor.roleCode === "ADMIN" || actor.roleCode === "COMPLIANCE") {
    return true;
  }
  if (actor.roleCode !== "STAFF") {
    return false;
  }
  return invoice.createdByUserId === actor.userId || invoice.assignedStaffUserId === actor.userId;
}

/**
 * Staff may issue a draft under the same own/assigned rule as edit draft.
 */
export function canIssueDraftInvoice(
  actor: AuthorizationPrincipal,
  invoice: Pick<InvoiceRecord, "createdByUserId" | "assignedStaffUserId" | "status">,
): boolean {
  return canStaffEditDraftInvoice(actor, invoice);
}

/**
 * Whether the actor may view this invoice.
 * Staff without invoice.view_assigned see only own/assigned (any status).
 */
export function canViewInvoice(
  actor: AuthorizationPrincipal,
  invoice: Pick<InvoiceRecord, "createdByUserId" | "assignedStaffUserId" | "status" | "companyId">,
): boolean {
  const scope = companyScopeForRole(actor.roleCode);
  if (scope === "ALL") {
    return true;
  }
  if (actor.roleCode === "COMPLIANCE") {
    return true; // company filter applied by caller
  }
  // Staff: own or assigned only (view_assigned optional policy is denied in V1).
  return invoice.createdByUserId === actor.userId || invoice.assignedStaffUserId === actor.userId;
}

/**
 * @deprecated Prefer canViewInvoice — kept for draft-service call sites.
 */
export function canViewDraftInvoice(
  actor: AuthorizationPrincipal,
  invoice: Pick<InvoiceRecord, "createdByUserId" | "assignedStaffUserId" | "status" | "companyId">,
): boolean {
  if (invoice.status !== "DRAFT") {
    return false;
  }
  return canViewInvoice(actor, invoice);
}
