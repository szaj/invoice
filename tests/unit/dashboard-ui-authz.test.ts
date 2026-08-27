import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import { parseDashboardKpiSearchParams } from "@/domain/reporting/schema";
import { getDashboardKpis } from "@/server/reporting/dashboard-service";
import type { DashboardInvoiceRow, DashboardPaymentRow } from "@/domain/reporting/types";
import { DASHBOARD_FORBIDDEN } from "@/domain/reporting/types";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";

function principal(
  roleCode: "ADMIN" | "COMPLIANCE" | "STAFF",
  assignedCompanyIds: string[] = [COMPANY_A],
): AuthorizationPrincipal {
  return {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: roleCode === "ADMIN" ? [] : assignedCompanyIds,
  };
}

describe("dashboard UI authorization (TASK-077)", () => {
  it("grants dashboard.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "dashboard.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "dashboard.view")).toBe(true);
    expect(roleHasPermission("STAFF", "dashboard.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "dashboard.view").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "dashboard.view").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "dashboard.view").allowed).toBe(true);
  });

  it("shows Dashboard nav when dashboard.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find((entry) => entry.href === "/");
    expect(item?.label).toBe("Dashboard");
    expect(item?.permissions).toEqual(["dashboard.view"]);

    const allowed = new Set<string>(["/"]);
    const groups = filterNavGroups(allowed);
    expect(groups.flatMap((group) => group.items).some((entry) => entry.href === "/")).toBe(true);
  });

  it("scopes Staff to assigned companies and denies unassigned company filter", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);

    const invoiceRow: DashboardInvoiceRow = {
      id: "33333333-3333-4333-8333-333333333333",
      companyId: COMPANY_A,
      customerId: "22222222-2222-4222-8222-222222222222",
      currencyCode: "USD",
      status: "ISSUED",
      complianceStatus: "NOT_REVIEWED",
      invoiceTotal: "100.00",
      confirmedPaidAmount: "0",
      outstandingAmount: "100.00",
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
      assignedStaffUserId: staff.userId,
      createdByUserId: staff.userId,
      decimalPrecision: 2,
    };

    const result = await getDashboardKpis(
      staff,
      { companyId: COMPANY_B },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listInvoiceRows: async () => [invoiceRow],
          listPaymentRows: async () => [] as DashboardPaymentRow[],
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(DASHBOARD_FORBIDDEN);
    }
  });

  it("passes visibleToStaffUserId for Staff KPI loads", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    let seenVisible: string | null | undefined;
    const result = await getDashboardKpis(
      staff,
      { companyId: COMPANY_A },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listInvoiceRows: async (filters) => {
            seenVisible = filters.visibleToStaffUserId;
            return [];
          },
          listPaymentRows: async () => [],
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(seenVisible).toBe(staff.userId);
  });

  it("parses search params without inventing reporting currency", () => {
    const query = parseDashboardKpiSearchParams({
      companyId: COMPANY_A,
      settlementCurrency: "aed",
    });
    expect(query).not.toHaveProperty("reportingCurrency");
    expect(query.settlementCurrency).toBe("AED");
  });
});
