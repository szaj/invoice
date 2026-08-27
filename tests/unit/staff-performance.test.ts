import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assertStaffPerformanceHasNoCommission,
  assertStaffPerformanceHasNoUnlabeledMixedTotal,
  buildStaffPerformanceRows,
  isStaffPerformanceInvoiceSent,
  paginateStaffPerformanceRows,
  sortStaffPerformanceRows,
} from "@/domain/reporting/staff-performance";
import { parseStaffPerformanceSearchParams } from "@/domain/reporting/schema";
import {
  STAFF_PERFORMANCE_FORBIDDEN,
  type StaffPerformanceRow,
  type StaffPerformanceSourceInvoice,
  type StaffPerformanceSourcePayment,
} from "@/domain/reporting/types";
import { getStaffPerformance } from "@/server/reporting/staff-performance-service";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const STAFF_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CUSTOMER_1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function principal(
  roleCode: "ADMIN" | "COMPLIANCE" | "STAFF",
  assignedCompanyIds: string[] = [COMPANY_A],
  userId: string = STAFF_A,
): AuthorizationPrincipal {
  return {
    userId,
    status: "ACTIVE",
    roleCode,
    assignedCompanyIds: roleCode === "ADMIN" ? [] : assignedCompanyIds,
  };
}

function sourceInvoice(
  overrides: Partial<StaffPerformanceSourceInvoice> = {},
): StaffPerformanceSourceInvoice {
  return {
    id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    companyId: COMPANY_A,
    customerId: CUSTOMER_1,
    currencyCode: "USD",
    status: "ISSUED",
    complianceStatus: "NOT_REVIEWED",
    invoiceNumber: "INV-001",
    invoiceTotal: "100.00",
    confirmedPaidAmount: "40.00",
    outstandingAmount: "60.00",
    invoiceDate: new Date("2026-01-01T00:00:00.000Z"),
    assignedStaffUserId: STAFF_A,
    assignedStaffName: "Alex Staff",
    createdByUserId: STAFF_A,
    createdByName: "Alex Staff",
    decimalPrecision: 2,
    ...overrides,
  };
}

function sourcePayment(
  overrides: Partial<StaffPerformanceSourcePayment> = {},
): StaffPerformanceSourcePayment {
  return {
    id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
    companyId: COMPANY_A,
    invoiceId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    customerId: CUSTOMER_1,
    status: "SUCCESSFUL",
    invoiceCurrencyCode: "USD",
    invoiceAmountApplied: "40.00",
    paymentDate: new Date("2026-01-02T00:00:00.000Z"),
    invoiceAssignedStaffUserId: STAFF_A,
    invoiceAssignedStaffName: "Alex Staff",
    invoiceDecimalPrecision: 2,
    ...overrides,
  };
}

describe("staff performance metrics (TASK-084)", () => {
  it("aggregates created/sent, value invoiced, and collections by staff", () => {
    const rows = buildStaffPerformanceRows(
      [
        sourceInvoice(),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
          invoiceNumber: null,
          status: "DRAFT",
          invoiceTotal: "50.00",
          confirmedPaidAmount: "0",
          outstandingAmount: "0",
        }),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii3",
          createdByUserId: STAFF_B,
          createdByName: "Blake Staff",
          assignedStaffUserId: STAFF_B,
          assignedStaffName: "Blake Staff",
          invoiceNumber: "INV-002",
          invoiceTotal: "200.00",
          confirmedPaidAmount: "0",
          outstandingAmount: "200.00",
        }),
      ],
      [
        sourcePayment(),
        sourcePayment({
          id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp2",
          invoiceAssignedStaffUserId: STAFF_B,
          invoiceAssignedStaffName: "Blake Staff",
          invoiceAmountApplied: "25.00",
        }),
      ],
    );

    expect(rows).toHaveLength(2);
    assertStaffPerformanceHasNoUnlabeledMixedTotal(rows);
    assertStaffPerformanceHasNoCommission(rows);

    const alex = rows.find((row) => row.staffUserId === STAFF_A);
    expect(alex?.staffDisplayName).toBe("Alex Staff");
    expect(alex?.invoicesCreated).toBe(2);
    expect(alex?.invoicesSent).toBe(1);
    expect(alex?.valueInvoiced).toEqual([{ currencyCode: "USD", amount: "100" }]);
    expect(alex?.collections).toEqual([{ currencyCode: "USD", amount: "40" }]);
    expect(alex?.collectionsCount).toBe(1);

    const blake = rows.find((row) => row.staffUserId === STAFF_B);
    expect(blake?.invoicesCreated).toBe(1);
    expect(blake?.invoicesSent).toBe(1);
    expect(blake?.valueInvoiced).toEqual([{ currencyCode: "USD", amount: "200" }]);
    expect(blake?.collections).toEqual([{ currencyCode: "USD", amount: "25" }]);
  });

  it("attributes collections to assigned staff, not the invoice creator", () => {
    const rows = buildStaffPerformanceRows(
      [
        sourceInvoice({
          createdByUserId: STAFF_A,
          createdByName: "Alex Staff",
          assignedStaffUserId: STAFF_B,
          assignedStaffName: "Blake Staff",
        }),
      ],
      [
        sourcePayment({
          invoiceAssignedStaffUserId: STAFF_B,
          invoiceAssignedStaffName: "Blake Staff",
          invoiceAmountApplied: "40.00",
        }),
      ],
    );

    const alex = rows.find((row) => row.staffUserId === STAFF_A);
    const blake = rows.find((row) => row.staffUserId === STAFF_B);
    expect(alex?.invoicesCreated).toBe(1);
    expect(alex?.collections).toEqual([]);
    expect(blake?.invoicesCreated).toBe(0);
    expect(blake?.collections).toEqual([{ currencyCode: "USD", amount: "40" }]);
  });

  it("treats issued invoices (invoice number present) as sent", () => {
    expect(isStaffPerformanceInvoiceSent({ invoiceNumber: "INV-1" })).toBe(true);
    expect(isStaffPerformanceInvoiceSent({ invoiceNumber: null })).toBe(false);
    expect(isStaffPerformanceInvoiceSent({ invoiceNumber: "  " })).toBe(false);
  });

  it("never calculates commission", () => {
    const rows = buildStaffPerformanceRows([sourceInvoice()], [sourcePayment()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("commission");
    expect(rows[0]).not.toHaveProperty("commissionAmount");
    expect(rows[0]).not.toHaveProperty("commissionRate");
    assertStaffPerformanceHasNoCommission(rows);

    const withCommission = [
      {
        ...rows[0],
        commission: "10.00",
      },
    ] as unknown as StaffPerformanceRow[];
    expect(() => assertStaffPerformanceHasNoCommission(withCommission)).toThrow(
      /must not invent commission/,
    );
  });

  it("never exposes an unlabeled mixed-currency total", () => {
    const rows = buildStaffPerformanceRows(
      [
        sourceInvoice({ currencyCode: "USD" }),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
          currencyCode: "EUR",
          invoiceTotal: "50.00",
          confirmedPaidAmount: "0",
          outstandingAmount: "50.00",
        }),
      ],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.valueInvoiced.map((b) => b.currencyCode).sort()).toEqual(["EUR", "USD"]);
    expect(rows[0]).not.toHaveProperty("grandTotal");
    expect(rows[0]).not.toHaveProperty("totalInvoiced");
    assertStaffPerformanceHasNoUnlabeledMixedTotal(rows);
  });

  it("ignores non-successful payments for collections", () => {
    const rows = buildStaffPerformanceRows(
      [sourceInvoice()],
      [
        sourcePayment({ status: "PENDING", invoiceAmountApplied: "99.00" }),
        sourcePayment({
          id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp2",
          status: "FAILED",
          invoiceAmountApplied: "50.00",
        }),
      ],
    );
    expect(rows[0]?.collections).toEqual([]);
    expect(rows[0]?.collectionsCount).toBe(0);
  });

  it("sorts and paginates staff rows", () => {
    const aggregated = buildStaffPerformanceRows(
      [
        sourceInvoice({ createdByUserId: STAFF_B, createdByName: "Blake Staff" }),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
          createdByUserId: STAFF_A,
          createdByName: "Alex Staff",
        }),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii3",
          createdByUserId: STAFF_A,
          createdByName: "Alex Staff",
        }),
      ],
      [],
    );

    const byStaff = sortStaffPerformanceRows(aggregated, "staff", "asc");
    expect(byStaff[0]?.staffDisplayName).toBe("Alex Staff");
    expect(byStaff[1]?.staffDisplayName).toBe("Blake Staff");

    const byCreated = sortStaffPerformanceRows(aggregated, "invoicesCreated", "desc");
    expect(byCreated[0]?.staffUserId).toBe(STAFF_A);
    expect(byCreated[0]?.invoicesCreated).toBe(2);

    const page = paginateStaffPerformanceRows(byStaff, 1, 1);
    expect(page.totalCount).toBe(2);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.staffDisplayName).toBe("Alex Staff");
  });
});

describe("staff performance UI authorization / scope (TASK-084)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "report.view").allowed).toBe(true);
  });

  it("shows Staff performance nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/staff",
    );
    expect(item?.label).toBe("Staff performance");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/staff"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups.flatMap((group) => group.items).some((entry) => entry.href === "/reports/staff"),
    ).toBe(true);
  });

  it("scopes Staff to assigned companies and denies unassigned company filter", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);

    const result = await getStaffPerformance(
      staff,
      { companyId: COMPANY_B },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listInvoiceRows: async () => [],
          listPaymentRows: async () => [],
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(STAFF_PERFORMANCE_FORBIDDEN);
    }
  });

  it("passes visibleToStaffUserId for Staff report loads", async () => {
    const staff = principal("STAFF", [COMPANY_A], STAFF_A);
    let seenVisible: string | null | undefined;
    const result = await getStaffPerformance(
      staff,
      { companyId: COMPANY_A },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listInvoiceRows: async (filters) => {
            seenVisible = filters.visibleToStaffUserId;
            return [sourceInvoice()];
          },
          listPaymentRows: async () => [sourcePayment()],
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(seenVisible).toBe(staff.userId);
    if (result.ok) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]?.staffUserId).toBe(STAFF_A);
      expect(result.data.rows[0]).not.toHaveProperty("commission");
    }
  });

  it("parses search params for staff performance filters", () => {
    const parsed = parseStaffPerformanceSearchParams({
      companyId: COMPANY_A,
      staffUserId: STAFF_A,
      invoiceCurrency: "aed",
      sortBy: "invoicesCreated",
      sortDir: "desc",
    });
    expect(parsed.companyId).toBe(COMPANY_A);
    expect(parsed.staffUserId).toBe(STAFF_A);
    expect(parsed.invoiceCurrency).toBe("AED");
    expect(parsed.sortBy).toBe("invoicesCreated");
    expect(parsed.sortDir).toBe("desc");
  });
});
