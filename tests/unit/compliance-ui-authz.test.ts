import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  parseComplianceQueueSearchParams,
  parseComplianceSubjectTypeParam,
} from "@/domain/compliance/schema";

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

describe("compliance review UI authorization (TASK-074)", () => {
  it("grants Admin/Compliance and denies Staff for compliance.review", () => {
    expect(roleHasPermission("ADMIN", "compliance.review")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "compliance.review")).toBe(true);
    expect(roleHasPermission("STAFF", "compliance.review")).toBe(false);

    expect(authorizePermission(principal("ADMIN"), "compliance.review").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "compliance.review").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "compliance.review").allowed).toBe(false);
  });

  it("shows Compliance nav only when compliance.review is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/compliance",
    );
    expect(item?.permissions).toEqual(["compliance.review"]);

    const staffAllowed = new Set<string>(["/", "/customers", "/invoices", "/payments"]);
    const staffGroups = filterNavGroups(staffAllowed);
    expect(
      staffGroups.flatMap((group) => group.items).some((entry) => entry.href === "/compliance"),
    ).toBe(false);

    const reviewerAllowed = new Set<string>([
      "/",
      "/customers",
      "/invoices",
      "/payments",
      "/compliance",
    ]);
    const reviewerGroups = filterNavGroups(reviewerAllowed);
    expect(
      reviewerGroups.flatMap((group) => group.items).some((entry) => entry.href === "/compliance"),
    ).toBe(true);
  });

  it("denies Staff opening unassigned company items", () => {
    const assignedCompanyId = "11111111-1111-4111-8111-111111111111";
    const unassignedCompanyId = "22222222-2222-4222-8222-222222222222";
    const staff = principal("STAFF", [assignedCompanyId]);

    // Staff has no compliance.review — cannot open review screens at all.
    expect(authorizePermission(staff, "compliance.review").allowed).toBe(false);

    // Staff also cannot access unassigned companies (same isolation as queue subjects).
    expect(authorizeCompanyAccess(staff, assignedCompanyId).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, unassignedCompanyId).allowed).toBe(false);
  });

  it("denies Compliance opening unassigned company items", () => {
    const assignedCompanyId = "11111111-1111-4111-8111-111111111111";
    const unassignedCompanyId = "22222222-2222-4222-8222-222222222222";
    const compliance = principal("COMPLIANCE", [assignedCompanyId]);

    expect(authorizePermission(compliance, "compliance.review").allowed).toBe(true);
    expect(authorizeCompanyAccess(compliance, assignedCompanyId).allowed).toBe(true);
    expect(authorizeCompanyAccess(compliance, unassignedCompanyId).allowed).toBe(false);
  });

  it("parses queue filters and subject type URL segments", () => {
    expect(
      parseComplianceQueueSearchParams({
        companyId: "11111111-1111-4111-8111-111111111111",
        status: "FLAGGED",
        subjectType: "INVOICE",
        gateway: "STRIPE",
        currency: "usd",
        amountMin: "10.00",
      }),
    ).toEqual({
      companyId: "11111111-1111-4111-8111-111111111111",
      status: "FLAGGED",
      subjectType: "INVOICE",
      gateway: "STRIPE",
      currency: "USD",
      amountMin: "10.00",
    });

    expect(parseComplianceQueueSearchParams({ status: "NOPE", companyId: "bad" })).toEqual({});

    expect(parseComplianceSubjectTypeParam("invoice")).toBe("INVOICE");
    expect(parseComplianceSubjectTypeParam("PAYMENT")).toBe("PAYMENT");
    expect(parseComplianceSubjectTypeParam("customer")).toBe("CUSTOMER");
    expect(parseComplianceSubjectTypeParam("unknown")).toBeNull();
  });
});
