import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import { parseInvoiceReportSearchParams } from "@/domain/reporting/schema";
import { INVOICE_REPORT_FORBIDDEN } from "@/domain/reporting/types";
import { getInvoiceReport } from "@/server/reporting/invoice-report-service";
import type { InvoiceReportRow } from "@/domain/reporting/types";

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

describe("invoice report UI authorization (TASK-078)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "report.view").allowed).toBe(true);
  });

  it("shows Invoice report nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/invoices",
    );
    expect(item?.label).toBe("Invoice report");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/invoices"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups.flatMap((group) => group.items).some((entry) => entry.href === "/reports/invoices"),
    ).toBe(true);
  });

  it("scopes Staff to assigned companies and denies unassigned company filter", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);

    const result = await getInvoiceReport(
      staff,
      { companyId: COMPANY_B },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listInvoiceReportPage: async () => ({ rows: [] as InvoiceReportRow[], totalCount: 0 }),
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(INVOICE_REPORT_FORBIDDEN);
    }
  });

  it("passes visibleToStaffUserId for Staff report loads", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    let seenVisible: string | null | undefined;
    const result = await getInvoiceReport(
      staff,
      { companyId: COMPANY_A },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listInvoiceReportPage: async (filters) => {
            seenVisible = filters.visibleToStaffUserId;
            return { rows: [], totalCount: 0 };
          },
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(seenVisible).toBe(staff.userId);
  });

  it("does not pass visibleToStaffUserId for Admin or Compliance", async () => {
    for (const role of ["ADMIN", "COMPLIANCE"] as const) {
      let seenVisible: string | null | undefined = "unset";
      const actor = principal(role, [COMPANY_A]);
      const result = await getInvoiceReport(
        actor,
        { companyId: COMPANY_A },
        {
          store: {
            listCompanyIdsInReportingGroup: async () => [],
            listInvoiceReportPage: async (filters) => {
              seenVisible = filters.visibleToStaffUserId;
              return { rows: [], totalCount: 0 };
            },
          },
        },
      );
      expect(result.ok).toBe(true);
      expect(seenVisible).toBeNull();
    }
  });

  it("parses search params with pagination/sort and without inventing reporting currency", () => {
    const query = parseInvoiceReportSearchParams({
      companyId: COMPANY_A,
      invoiceCurrency: "aed",
      page: "2",
      pageSize: "25",
      sortBy: "balance",
      sortDir: "asc",
    });
    expect(query).not.toHaveProperty("reportingCurrency");
    expect(query.invoiceCurrency).toBe("AED");
    expect(query.page).toBe(2);
    expect(query.pageSize).toBe(25);
    expect(query.sortBy).toBe("balance");
    expect(query.sortDir).toBe("asc");
  });
});
