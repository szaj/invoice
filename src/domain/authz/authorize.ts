import { AuthorizationError, type AuthorizationDenialReason } from "@/domain/authz/errors";
import type { PermissionCode } from "@/domain/authz/permissions";
import { roleHasPermission } from "@/domain/authz/matrix";
import type { RoleCode } from "@/domain/authz/roles";

export type UserAuthorizationStatus = "ACTIVE" | "SUSPENDED";

/**
 * Application authorization principal.
 * Loaded from the application database, never from Supabase Auth metadata.
 * assignedCompanyIds come from user_companies. Admin ALL access does not depend on them.
 */
export interface AuthorizationPrincipal {
  readonly userId: string;
  readonly status: UserAuthorizationStatus;
  readonly roleCode: RoleCode | null;
  readonly assignedCompanyIds?: readonly string[];
}

export type AuthorizationDecision =
  { allowed: true; roleCode: RoleCode } | { allowed: false; reason: AuthorizationDenialReason };

export function authorizePermission(
  principal: AuthorizationPrincipal | null,
  permission: PermissionCode,
): AuthorizationDecision {
  if (!principal) {
    return { allowed: false, reason: "unauthenticated" };
  }

  if (principal.status !== "ACTIVE") {
    return { allowed: false, reason: "suspended" };
  }

  if (!principal.roleCode) {
    return { allowed: false, reason: "missing_role" };
  }

  if (!roleHasPermission(principal.roleCode, permission)) {
    return { allowed: false, reason: "denied" };
  }

  return { allowed: true, roleCode: principal.roleCode };
}

export function assertPermission(
  principal: AuthorizationPrincipal | null,
  permission: PermissionCode,
): RoleCode {
  const decision = authorizePermission(principal, permission);
  if (!decision.allowed) {
    throw new AuthorizationError(decision.reason);
  }

  return decision.roleCode;
}

/**
 * Customer/invoice/payment hard-delete is never allowed through the UI.
 * Admin customer.delete is soft-delete/deactivation only (Roles and Permissions footnote).
 */
export function canHardDeleteCustomer(): false {
  return false;
}

export function canHardDeleteInvoice(): false {
  return false;
}

export function canHardDeleteFinancialRecord(): false {
  return false;
}
