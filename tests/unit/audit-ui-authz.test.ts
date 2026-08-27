import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import { parseAuditViewerSearchParams } from "@/domain/audit/schema";

function principal(
  roleCode: "ADMIN" | "COMPLIANCE" | "STAFF",
  assignedCompanyIds: string[] = ["11111111-1111-4111-8111-111111111111"],
): AuthorizationPrincipal {
  return {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: roleCode === "ADMIN" ? [] : assignedCompanyIds,
  };
}

describe("audit viewer UI authorization (TASK-076)", () => {
  it("grants Admin/Compliance and denies Staff for audit.read", () => {
    expect(roleHasPermission("ADMIN", "audit.read")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "audit.read")).toBe(true);
    expect(roleHasPermission("STAFF", "audit.read")).toBe(false);

    expect(authorizePermission(principal("ADMIN"), "audit.read").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "audit.read").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "audit.read").allowed).toBe(false);
  });

  it("shows Audit logs nav only when audit.read is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/audit",
    );
    expect(item?.permissions).toEqual(["audit.read"]);

    const staffAllowed = new Set<string>(["/", "/customers", "/invoices", "/payments"]);
    const staffGroups = filterNavGroups(staffAllowed);
    expect(
      staffGroups.flatMap((group) => group.items).some((entry) => entry.href === "/audit"),
    ).toBe(false);

    const reviewerAllowed = new Set<string>([
      "/",
      "/customers",
      "/invoices",
      "/payments",
      "/audit",
    ]);
    const reviewerGroups = filterNavGroups(reviewerAllowed);
    expect(
      reviewerGroups.flatMap((group) => group.items).some((entry) => entry.href === "/audit"),
    ).toBe(true);
  });

  it("denies Staff and unassigned Compliance company access for the viewer", () => {
    const assignedCompanyId = "11111111-1111-4111-8111-111111111111";
    const unassignedCompanyId = "22222222-2222-4222-8222-222222222222";
    const staff = principal("STAFF", [assignedCompanyId]);
    const compliance = principal("COMPLIANCE", [assignedCompanyId]);

    expect(authorizePermission(staff, "audit.read").allowed).toBe(false);
    expect(authorizeCompanyAccess(staff, unassignedCompanyId).allowed).toBe(false);
    expect(authorizeCompanyAccess(compliance, assignedCompanyId).allowed).toBe(true);
    expect(authorizeCompanyAccess(compliance, unassignedCompanyId).allowed).toBe(false);
  });

  it("parses viewer search params for the audit screen", () => {
    expect(
      parseAuditViewerSearchParams({
        companyId: "11111111-1111-4111-8111-111111111111",
        actorType: "SYSTEM",
        entityType: "settings",
        action: "settings.updated",
      }),
    ).toEqual({
      companyId: "11111111-1111-4111-8111-111111111111",
      actorType: "SYSTEM",
      entityType: "settings",
      action: "settings.updated",
    });
  });
});
