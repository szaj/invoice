import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import type { RoleCode } from "@/domain/authz/roles";

export const ASSIGNED_COMPANY_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";

export function principal(
  roleCode: RoleCode | null,
  options: {
    assignedCompanyIds?: readonly string[];
    status?: "ACTIVE" | "SUSPENDED";
    userId?: string;
  } = {},
): AuthorizationPrincipal {
  const assignedCompanyIds =
    options.assignedCompanyIds ??
    (roleCode === "ADMIN" ? [] : [ASSIGNED_COMPANY_ID]);

  return {
    userId: options.userId ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: options.status ?? "ACTIVE",
    roleCode,
    assignedCompanyIds,
  };
}

/** Authenticated identity without an application role — must never authorize. */
export function authenticatedWithoutRole(): AuthorizationPrincipal {
  return {
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    status: "ACTIVE",
    roleCode: null,
    assignedCompanyIds: [],
  };
}
