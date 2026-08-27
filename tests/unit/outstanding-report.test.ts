import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assertOutstandingReportUsesStoredBalance,
  computeOutstandingAgeDays,
  filterOutstandingReportEligibleRows,
  isOutstandingReportEligible,
} from "@/domain/reporting/outstanding-report";
import { parseOutstandingReportSearchParams } from "@/domain/reporting/schema";
import { OUTSTANDING_REPORT_FORBIDDEN, type OutstandingReportRow } from "@/domain/reporting/types";
import { getOutstandingReport } from "@/server/reporting/outstanding-report-service";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const INVOICE_A = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_A = "44444444-4444-4444-8444-444444444444";

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

function outstandingRow(overrides: Partial<OutstandingReportRow> = {}): OutstandingReportRow {
  return {
    id: INVOICE_A,
    invoiceNumber: "INV-001",
    customerId: CUSTOMER_A,
    customerDisplayName: "Acme",
    companyId: COMPANY_A,
    companyDisplayName: "Brand A",
    dueDate: "2026-08-01",
    ageDays: 26,
    currencyCode: "USD",
    outstandingAmount: "150.00",
    status: "OVERDUE",
    assignedStaffUserId: null,
    assignedStaffName: null,
    decimalPrecision: 2,
    ...overrides,
  };
}

describe("outstanding report cancelled exclusion (TASK-080 / BR-019)", () => {
  it("excludes cancelled invoices from collectible outstanding by default", () => {
    const rows = [
      { status: "ISSUED" as const, outstandingAmount: "100.00" },
      { status: "CANCELLED" as const, outstandingAmount: "100.00" },
      { status: "PARTIALLY_PAID" as const, outstandingAmount: "50.00" },
      { status: "DRAFT" as const, outstandingAmount: "80.00" },
      { status: "OVERDUE" as const, outstandingAmount: "0.00" },
    ];

    const eligible = filterOutstandingReportEligibleRows(rows);
    expect(eligible).toHaveLength(2);
    expect(eligible.map((row) => row.status)).toEqual(["ISSUED", "PARTIALLY_PAID"]);
    expect(eligible.every((row) => row.status !== "CANCELLED")).toBe(true);
  });

  it("treats cancelled as not eligible even with positive balance", () => {
    expect(isOutstandingReportEligible({ status: "CANCELLED", outstandingAmount: "999.00" })).toBe(
      false,
    );
    expect(isOutstandingReportEligible({ status: "ISSUED", outstandingAmount: "999.00" })).toBe(
      true,
    );
  });

  it("rejects cancelled rows in stored-balance assertion", () => {
    expect(() =>
      assertOutstandingReportUsesStoredBalance([
        outstandingRow({ status: "CANCELLED", outstandingAmount: "10.00" }),
      ]),
    ).toThrow(/cancelled/i);
  });
});

describe("outstanding report age and stored balance (TASK-080 / BR-009)", () => {
  it("computes age as days past due (0 when not yet due)", () => {
    const asOf = new Date("2026-08-27T12:00:00.000Z");
    expect(computeOutstandingAgeDays(new Date("2026-08-01T00:00:00.000Z"), asOf)).toBe(26);
    expect(computeOutstandingAgeDays(new Date("2026-08-27T00:00:00.000Z"), asOf)).toBe(0);
    expect(computeOutstandingAgeDays(new Date("2026-09-01T00:00:00.000Z"), asOf)).toBe(0);
  });

  it("requires stored outstanding greater than zero", () => {
    expect(() =>
      assertOutstandingReportUsesStoredBalance([outstandingRow({ outstandingAmount: "0.00" })]),
    ).toThrow(/open balance/i);
    expect(() => assertOutstandingReportUsesStoredBalance([outstandingRow()])).not.toThrow();
  });
});

describe("outstanding report UI authorization (TASK-080)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "report.view").allowed).toBe(true);
  });

  it("shows Outstanding report nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/outstanding",
    );
    expect(item?.label).toBe("Outstanding report");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/outstanding"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups.flatMap((group) => group.items).some((entry) => entry.href === "/reports/outstanding"),
    ).toBe(true);
  });

  it("scopes Staff to assigned companies and denies unassigned company filter", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);

    const result = await getOutstandingReport(
      staff,
      { companyId: COMPANY_B },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listOutstandingReportPage: async () => ({
            rows: [] as OutstandingReportRow[],
            totalCount: 0,
          }),
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(OUTSTANDING_REPORT_FORBIDDEN);
    }
  });

  it("passes visibleToStaffUserId for Staff report loads", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    let seenVisible: string | null | undefined;
    const result = await getOutstandingReport(
      staff,
      { companyId: COMPANY_A },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listOutstandingReportPage: async (filters) => {
            seenVisible = filters.visibleToStaffUserId;
            return { rows: [outstandingRow()], totalCount: 1 };
          },
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(seenVisible).toBe(staff.userId);
  });

  it("parses search params for outstanding filters", () => {
    const parsed = parseOutstandingReportSearchParams({
      companyId: COMPANY_A,
      sortBy: "age",
      sortDir: "desc",
      invoiceStatus: "OVERDUE",
    });
    expect(parsed.companyId).toBe(COMPANY_A);
    expect(parsed.sortBy).toBe("age");
    expect(parsed.sortDir).toBe("desc");
    expect(parsed.invoiceStatus).toBe("OVERDUE");
  });
});
