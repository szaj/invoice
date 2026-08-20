import { ROLE_PERMISSIONS } from "@/domain/authz/matrix";
import { PERMISSION_DEFINITIONS, type PermissionCode } from "@/domain/authz/permissions";
import { ROLE_DEFINITIONS, ROLE_CODES, type RoleCode } from "@/domain/authz/roles";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";

export interface RoleCatalogEntry {
  readonly code: RoleCode;
  readonly name: string;
  readonly companyScope: "ALL" | "ASSIGNED";
  readonly permissions: readonly PermissionCode[];
}

export function listRoleCatalog(): readonly RoleCatalogEntry[] {
  return ROLE_CODES.map((code) => ({
    code,
    name: ROLE_DEFINITIONS[code].name,
    companyScope: ROLE_DEFINITIONS[code].companyScope,
    permissions: [...ROLE_PERMISSIONS[code]].sort(),
  }));
}

export function permissionName(code: PermissionCode): string {
  return PERMISSION_DEFINITIONS[code].name;
}

/**
 * Representative protected action: listing roles requires user.manage (Admin).
 */
export function listRolesForPrincipal(
  principal: AuthorizationPrincipal | null,
): readonly RoleCatalogEntry[] {
  assertPermission(principal, "user.manage");
  return listRoleCatalog();
}
