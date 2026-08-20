import { AuthorizationError } from "@/domain/authz/errors";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { ROLE_DEFINITIONS, type RoleCode } from "@/domain/authz/roles";

export function assignedCompanyIdsOf(
  principal: AuthorizationPrincipal | null | undefined,
): readonly string[] {
  return principal?.assignedCompanyIds ?? [];
}

export function companyScopeForRole(roleCode: RoleCode | null): "ALL" | "ASSIGNED" | null {
  if (!roleCode) {
    return null;
  }
  return ROLE_DEFINITIONS[roleCode].companyScope;
}

/**
 * Company access is application-owned. Reporting-group membership is not authorization.
 * Admin (ALL) may access every company. Compliance and Staff may access assigned companies only.
 */
export function authorizeCompanyAccess(
  principal: AuthorizationPrincipal | null,
  companyId: string,
):
  | { allowed: true }
  | { allowed: false; reason: "unauthenticated" | "suspended" | "missing_role" | "denied" } {
  if (!principal) {
    return { allowed: false, reason: "unauthenticated" };
  }
  if (principal.status !== "ACTIVE") {
    return { allowed: false, reason: "suspended" };
  }
  if (!principal.roleCode) {
    return { allowed: false, reason: "missing_role" };
  }

  const scope = companyScopeForRole(principal.roleCode);
  if (scope === "ALL") {
    return { allowed: true };
  }
  if (scope === "ASSIGNED" && assignedCompanyIdsOf(principal).includes(companyId)) {
    return { allowed: true };
  }

  return { allowed: false, reason: "denied" };
}

export function assertCompanyAccess(
  principal: AuthorizationPrincipal | null,
  companyId: string,
): RoleCode {
  const decision = authorizeCompanyAccess(principal, companyId);
  if (!decision.allowed) {
    throw new AuthorizationError(decision.reason);
  }
  if (!principal?.roleCode) {
    throw new AuthorizationError("missing_role");
  }
  return principal.roleCode;
}

export function canAccessCompany(
  principal: AuthorizationPrincipal | null,
  companyId: string,
): boolean {
  return authorizeCompanyAccess(principal, companyId).allowed;
}
