import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { roleHasPermission } from "@/domain/authz/matrix";

function principal(roleCode: "ADMIN" | "COMPLIANCE" | "STAFF"): AuthorizationPrincipal {
  return {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: roleCode === "ADMIN" ? [] : ["11111111-1111-4111-8111-111111111111"],
  };
}

describe("manual payment UI authorization (TASK-051)", () => {
  it("grants Admin/Compliance and denies Staff for payment.manual.record (US-007)", () => {
    expect(roleHasPermission("ADMIN", "payment.manual.record")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "payment.manual.record")).toBe(true);
    expect(roleHasPermission("STAFF", "payment.manual.record")).toBe(false);

    expect(authorizePermission(principal("ADMIN"), "payment.manual.record").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "payment.manual.record").allowed).toBe(
      true,
    );
    expect(authorizePermission(principal("STAFF"), "payment.manual.record").allowed).toBe(false);
  });

  it("shows Manual payment nav only when payment.manual.record is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/payments/manual",
    );
    expect(item?.permissions).toEqual(["payment.manual.record"]);

    const staffAllowed = new Set<string>(["/", "/customers", "/invoices"]);
    const staffGroups = filterNavGroups(staffAllowed);
    expect(
      staffGroups
        .flatMap((group) => group.items)
        .some((entry) => entry.href === "/payments/manual"),
    ).toBe(false);

    const adminAllowed = new Set<string>(["/", "/customers", "/invoices", "/payments/manual"]);
    const adminGroups = filterNavGroups(adminAllowed);
    expect(
      adminGroups
        .flatMap((group) => group.items)
        .some((entry) => entry.href === "/payments/manual"),
    ).toBe(true);
  });
});
