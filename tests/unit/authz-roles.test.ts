import { describe, expect, it } from "vitest";

import {
  assertPermission,
  authorizePermission,
  canHardDeleteCustomer,
  canHardDeleteFinancialRecord,
  canHardDeleteInvoice,
  type AuthorizationPrincipal,
} from "@/domain/authz/authorize";
import { listRoleCatalog, listRolesForPrincipal } from "@/domain/authz/catalog";
import { AuthorizationError, GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { OPEN_STAFF_POLICIES, roleHasPermission } from "@/domain/authz/matrix";
import { PERMISSION_CODES, type PermissionCode } from "@/domain/authz/permissions";
import { ROLE_CODES, ROLE_DEFINITIONS, type RoleCode } from "@/domain/authz/roles";

function principal(roleCode: RoleCode | null, status: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
  return {
    userId: "user-1",
    status,
    roleCode,
  } satisfies AuthorizationPrincipal;
}

describe("role catalog", () => {
  it("defines Admin, Compliance, and Staff with company scope capabilities", () => {
    expect(ROLE_CODES).toEqual(["ADMIN", "COMPLIANCE", "STAFF"]);
    expect(ROLE_DEFINITIONS.ADMIN.companyScope).toBe("ALL");
    expect(ROLE_DEFINITIONS.COMPLIANCE.companyScope).toBe("ASSIGNED");
    expect(ROLE_DEFINITIONS.STAFF.companyScope).toBe("ASSIGNED");
  });
});

describe("permission matrix", () => {
  const expected: Record<RoleCode, Record<PermissionCode, boolean>> = {
    ADMIN: {
      "dashboard.view": true,
      "company.write": true,
      "gateway.credentials.manage": true,
      "customer.create": true,
      "customer.edit": true,
      "customer.delete": true,
      "invoice.create": true,
      "invoice.edit_draft": true,
      "invoice.edit_issued": true,
      "invoice.cancel": true,
      "invoice.delete": false,
      "payment.manual.record": true,
      "payment.adjust": true,
      "invoice.view_assigned": true,
      "report.view": true,
      "report.export": true,
      "compliance.review": true,
      "audit.read": true,
      "user.manage": true,
      "currency.manage": true,
    },
    COMPLIANCE: {
      "dashboard.view": true,
      "company.write": false,
      "gateway.credentials.manage": false,
      "customer.create": true,
      "customer.edit": true,
      "customer.delete": false,
      "invoice.create": true,
      "invoice.edit_draft": true,
      "invoice.edit_issued": true,
      "invoice.cancel": true,
      "invoice.delete": false,
      "payment.manual.record": true,
      "payment.adjust": true,
      "invoice.view_assigned": true,
      "report.view": true,
      "report.export": true,
      "compliance.review": true,
      "audit.read": true,
      "user.manage": false,
      "currency.manage": false,
    },
    STAFF: {
      "dashboard.view": true,
      "company.write": false,
      "gateway.credentials.manage": false,
      "customer.create": true,
      "customer.edit": true,
      "customer.delete": false,
      "invoice.create": true,
      "invoice.edit_draft": true,
      "invoice.edit_issued": false,
      "invoice.cancel": false,
      "invoice.delete": false,
      "payment.manual.record": false,
      "payment.adjust": false,
      "invoice.view_assigned": false,
      "report.view": true,
      "report.export": false,
      "compliance.review": false,
      "audit.read": false,
      "user.manage": false,
      "currency.manage": false,
    },
  };

  it("matches the Roles and Permissions matrix without inventing optional Staff grants", () => {
    for (const role of ROLE_CODES) {
      for (const permission of PERMISSION_CODES) {
        expect(roleHasPermission(role, permission), `${role} ${permission}`).toBe(
          expected[role][permission],
        );
      }
    }
  });

  it("records optional Staff policies as open and denied", () => {
    expect(OPEN_STAFF_POLICIES.map((policy) => policy.id)).toEqual([
      "US-007",
      "US-008",
      "US-009",
      "US-010",
    ]);
    for (const policy of OPEN_STAFF_POLICIES) {
      expect(policy.grant).toBe(false);
      expect(roleHasPermission("STAFF", policy.permission)).toBe(false);
    }
  });
});

describe("authorizePermission", () => {
  it("denies unauthenticated, suspended, and unassigned principals", () => {
    expect(authorizePermission(null, "dashboard.view")).toEqual({
      allowed: false,
      reason: "unauthenticated",
    });
    expect(authorizePermission(principal("ADMIN", "SUSPENDED"), "dashboard.view")).toEqual({
      allowed: false,
      reason: "suspended",
    });
    expect(authorizePermission(principal(null), "dashboard.view")).toEqual({
      allowed: false,
      reason: "missing_role",
    });
  });

  it("never treats authentication alone as authorization", () => {
    const authenticatedWithoutRole = principal(null);
    expect(authenticatedWithoutRole.userId).toBeTruthy();
    expect(authorizePermission(authenticatedWithoutRole, "dashboard.view").allowed).toBe(false);
  });
});

describe("hard-delete restrictions", () => {
  it("never allows hard-delete of customers, invoices, or financial records", () => {
    expect(canHardDeleteCustomer()).toBe(false);
    expect(canHardDeleteInvoice()).toBe(false);
    expect(canHardDeleteFinancialRecord()).toBe(false);
  });
});

describe("representative protected action: list roles (user.manage)", () => {
  it("allows Admin and returns 403 for Compliance and Staff", () => {
    const roles = listRolesForPrincipal(principal("ADMIN"));
    expect(roles.map((role) => role.code)).toEqual(["ADMIN", "COMPLIANCE", "STAFF"]);

    for (const role of ["COMPLIANCE", "STAFF"] as const) {
      try {
        listRolesForPrincipal(principal(role));
        throw new Error(`expected ${role} to be denied`);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthorizationError);
        if (error instanceof AuthorizationError) {
          expect(error.status).toBe(403);
          expect(error.message).toBe(GENERIC_FORBIDDEN);
          expect(error.reason).toBe("denied");
        }
      }
    }
  });

  it("does not expose Auth metadata fields on the catalog", () => {
    const catalog = listRoleCatalog();
    for (const role of catalog) {
      expect(role).not.toHaveProperty("user_metadata");
      expect(role).not.toHaveProperty("app_metadata");
    }
  });
});

describe("assertPermission", () => {
  it("throws 401 when unauthenticated", () => {
    try {
      assertPermission(null, "user.manage");
      throw new Error("expected unauthenticated denial");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError);
      if (error instanceof AuthorizationError) {
        expect(error.status).toBe(401);
      }
    }
  });
});
