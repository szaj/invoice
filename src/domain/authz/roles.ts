export const ROLE_CODES = ["ADMIN", "COMPLIANCE", "STAFF"] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_COMPANY_SCOPES = ["ALL", "ASSIGNED"] as const;

export type RoleCompanyScope = (typeof ROLE_COMPANY_SCOPES)[number];

export const ROLE_DEFINITIONS = {
  ADMIN: {
    code: "ADMIN",
    name: "Admin",
    companyScope: "ALL",
  },
  COMPLIANCE: {
    code: "COMPLIANCE",
    name: "Compliance",
    companyScope: "ASSIGNED",
  },
  STAFF: {
    code: "STAFF",
    name: "Staff",
    companyScope: "ASSIGNED",
  },
} as const satisfies Record<
  RoleCode,
  { code: RoleCode; name: string; companyScope: RoleCompanyScope }
>;

export function isRoleCode(value: string | null | undefined): value is RoleCode {
  return value === "ADMIN" || value === "COMPLIANCE" || value === "STAFF";
}
