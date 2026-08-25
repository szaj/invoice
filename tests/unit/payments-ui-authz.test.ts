import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { STATUS_TONES } from "@/components/data/status-badge";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { roleHasPermission } from "@/domain/authz/matrix";
import { parsePaymentListSearchParams } from "@/domain/payments/schema";

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

    const staffAllowed = new Set<string>(["/", "/customers", "/invoices", "/payments"]);
    const staffGroups = filterNavGroups(staffAllowed);
    expect(
      staffGroups
        .flatMap((group) => group.items)
        .some((entry) => entry.href === "/payments/manual"),
    ).toBe(false);

    const adminAllowed = new Set<string>([
      "/",
      "/customers",
      "/invoices",
      "/payments",
      "/payments/manual",
    ]);
    const adminGroups = filterNavGroups(adminAllowed);
    expect(
      adminGroups
        .flatMap((group) => group.items)
        .some((entry) => entry.href === "/payments/manual"),
    ).toBe(true);
  });
});

describe("payment list UI authorization (TASK-061)", () => {
  it("shows Payments nav when invoice.create is allowed (Staff included)", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/payments",
    );
    expect(item?.permissions).toEqual(["invoice.create"]);

    expect(roleHasPermission("STAFF", "invoice.create")).toBe(true);
    expect(authorizePermission(principal("STAFF"), "invoice.create").allowed).toBe(true);

    const staffAllowed = new Set<string>(["/", "/customers", "/invoices", "/payments"]);
    const staffGroups = filterNavGroups(staffAllowed);
    expect(
      staffGroups.flatMap((group) => group.items).some((entry) => entry.href === "/payments"),
    ).toBe(true);
  });

  it("parses company-scoped list filters from search params", () => {
    expect(
      parsePaymentListSearchParams({
        companyId: "11111111-1111-4111-8111-111111111111",
        status: "SUCCESSFUL",
      }),
    ).toEqual({
      companyId: "11111111-1111-4111-8111-111111111111",
      status: "SUCCESSFUL",
    });

    expect(parsePaymentListSearchParams({ companyId: "not-a-uuid", status: "NOPE" })).toEqual({});
  });
});

describe("payment detail UI authorization (TASK-062)", () => {
  it("requires invoice.create for payment detail view (same family as list)", () => {
    expect(roleHasPermission("ADMIN", "invoice.create")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "invoice.create")).toBe(true);
    expect(roleHasPermission("STAFF", "invoice.create")).toBe(true);

    expect(authorizePermission(principal("STAFF"), "invoice.create").allowed).toBe(true);
  });

  it("keeps SUCCESSFUL status as the original payment lifecycle badge label", () => {
    // Detail UI shows StatusBadge(status) without rewriting SUCCESSFUL when adjustments exist later.
    expect(STATUS_TONES.SUCCESSFUL).toBe("success");
    expect(STATUS_TONES.PENDING).toBe("warning");
    expect(STATUS_TONES.FAILED).toBe("destructive");
  });
});

describe("payment adjustment UI authorization (TASK-069)", () => {
  it("grants Admin/Compliance and denies Staff for payment.adjust", () => {
    expect(roleHasPermission("ADMIN", "payment.adjust")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "payment.adjust")).toBe(true);
    expect(roleHasPermission("STAFF", "payment.adjust")).toBe(false);

    expect(authorizePermission(principal("ADMIN"), "payment.adjust").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "payment.adjust").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "payment.adjust").allowed).toBe(false);
  });

  it("hides mutation actions for Staff while preserving SUCCESSFUL core status tone", () => {
    // Staff can view detail/history via invoice.create; mutation buttons require payment.adjust.
    expect(authorizePermission(principal("STAFF"), "invoice.create").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "payment.adjust").allowed).toBe(false);
    expect(STATUS_TONES.SUCCESSFUL).toBe("success");
    expect(STATUS_TONES.DISPUTED).toBe("warning");
    expect(STATUS_TONES.REFUNDED).toBe("info");
    expect(STATUS_TONES.CHARGEBACK_DEBITED).toBe("destructive");
  });
});
