import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assertCompanyPerformanceHasNoUnlabeledMixedTotal,
  assertCompanyPerformanceOwnershipIsOriginalCompany,
  buildCompanyPerformanceRows,
  paginateCompanyPerformanceRows,
  sortCompanyPerformanceRows,
} from "@/domain/reporting/company-performance";
import { parseCompanyPerformanceSearchParams } from "@/domain/reporting/schema";
import {
  COMPANY_PERFORMANCE_FORBIDDEN,
  type CompanyPerformanceSourceInvoice,
  type CompanyPerformanceSourcePayment,
} from "@/domain/reporting/types";
import { getCompanyPerformance } from "@/server/reporting/company-performance-service";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const REPORTING_GROUP = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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

function sourceInvoice(
  overrides: Partial<CompanyPerformanceSourceInvoice> = {},
): CompanyPerformanceSourceInvoice {
  return {
    id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    companyId: COMPANY_A,
    companyDisplayName: "Brand A",
    customerId: CUSTOMER_1,
    currencyCode: "USD",
    status: "ISSUED",
    complianceStatus: "NOT_REVIEWED",
    invoiceTotal: "100.00",
    confirmedPaidAmount: "40.00",
    outstandingAmount: "60.00",
    dueDate: new Date("2026-01-15T00:00:00.000Z"),
    invoiceDate: new Date("2026-01-01T00:00:00.000Z"),
    assignedStaffUserId: null,
    createdByUserId: null,
    decimalPrecision: 2,
    ...overrides,
  };
}

function sourcePayment(
  overrides: Partial<CompanyPerformanceSourcePayment> = {},
): CompanyPerformanceSourcePayment {
  return {
    id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
    companyId: COMPANY_A,
    companyDisplayName: "Brand A",
    invoiceId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    customerId: CUSTOMER_1,
    methodCode: "STRIPE",
    status: "SUCCESSFUL",
    complianceStatus: "NOT_REVIEWED",
    invoiceCurrencyCode: "USD",
    invoiceAmountApplied: "40.00",
    settlementCurrencyCode: "AED",
    convertedSettlementAmount: "147.00",
    processorFeeAmount: "2.00",
    actualReceivedAmount: "145.00",
    paymentDate: new Date("2026-01-02T00:00:00.000Z"),
    invoiceCreatedByUserId: null,
    invoiceAssignedStaffUserId: null,
    invoiceDecimalPrecision: 2,
    settlementDecimalPrecision: 2,
    ...overrides,
  };
}

describe("company performance KPIs by owning company (TASK-083)", () => {
  it("aggregates invoice and settlement KPIs per owning company", () => {
    const rows = buildCompanyPerformanceRows(
      [
        sourceInvoice(),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
          companyId: COMPANY_B,
          companyDisplayName: "Brand B",
          invoiceTotal: "200.00",
          confirmedPaidAmount: "0",
          outstandingAmount: "200.00",
        }),
      ],
      [
        sourcePayment(),
        sourcePayment({
          id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp2",
          companyId: COMPANY_B,
          companyDisplayName: "Brand B",
          invoiceAmountApplied: "10.00",
          convertedSettlementAmount: "36.00",
          processorFeeAmount: "1.00",
          actualReceivedAmount: null,
        }),
      ],
    );

    expect(rows).toHaveLength(2);
    assertCompanyPerformanceHasNoUnlabeledMixedTotal(rows);

    const brandA = rows.find((row) => row.companyId === COMPANY_A);
    expect(brandA?.companyDisplayName).toBe("Brand A");
    expect(brandA?.invoiceCurrencies).toEqual([
      {
        currencyCode: "USD",
        totalInvoiced: "100",
        totalPaid: "40",
        outstanding: "60",
        overdue: "60",
      },
    ]);
    expect(brandA?.settlementCurrencies).toEqual([
      {
        currencyCode: "AED",
        convertedSettlement: "147",
        processorFees: "2",
        actualReceived: "145",
      },
    ]);
    expect(brandA?.invoiceCount).toBe(1);
    expect(brandA?.paymentCount).toBe(1);

    const brandB = rows.find((row) => row.companyId === COMPANY_B);
    expect(brandB?.invoiceCurrencies[0]?.totalInvoiced).toBe("200");
    expect(brandB?.settlementCurrencies[0]?.convertedSettlement).toBe("36");
  });

  it("keeps ownership on original company ids — never invents reporting-group ownership", () => {
    const invoices = [
      sourceInvoice({ companyId: COMPANY_A, companyDisplayName: "Brand A" }),
      sourceInvoice({
        id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
        companyId: COMPANY_B,
        companyDisplayName: "Brand B",
      }),
    ];
    const rows = buildCompanyPerformanceRows(invoices, []);
    expect(rows.map((row) => row.companyId).sort()).toEqual([COMPANY_A, COMPANY_B].sort());
    // Reporting group id must never appear as a company performance row key.
    expect(rows.every((row) => row.companyId !== REPORTING_GROUP)).toBe(true);
    assertCompanyPerformanceOwnershipIsOriginalCompany(
      rows,
      invoices.map((invoice) => invoice.companyId),
    );
  });

  it("never exposes an unlabeled mixed-currency total", () => {
    const rows = buildCompanyPerformanceRows(
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
    expect(rows[0]?.invoiceCurrencies.map((b) => b.currencyCode).sort()).toEqual(["EUR", "USD"]);
    expect(rows[0]).not.toHaveProperty("grandTotal");
    expect(rows[0]).not.toHaveProperty("totalInvoiced");
    assertCompanyPerformanceHasNoUnlabeledMixedTotal(rows);
  });

  it("does not deduct processor fees from converted settlement", () => {
    const rows = buildCompanyPerformanceRows(
      [sourceInvoice()],
      [
        sourcePayment({
          convertedSettlementAmount: "100.00",
          processorFeeAmount: "5.00",
          actualReceivedAmount: "95.00",
        }),
      ],
    );
    const settlement = rows[0]?.settlementCurrencies[0];
    expect(settlement?.convertedSettlement).toBe("100");
    expect(settlement?.processorFees).toBe("5");
    expect(settlement?.actualReceived).toBe("95");
  });

  it("sorts and paginates company rows", () => {
    const aggregated = buildCompanyPerformanceRows(
      [
        sourceInvoice({ companyId: COMPANY_B, companyDisplayName: "Brand B" }),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
          companyId: COMPANY_A,
          companyDisplayName: "Brand A",
        }),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii3",
          companyId: COMPANY_A,
          companyDisplayName: "Brand A",
        }),
      ],
      [],
    );

    const byCompany = sortCompanyPerformanceRows(aggregated, "company", "asc");
    expect(byCompany[0]?.companyDisplayName).toBe("Brand A");
    expect(byCompany[1]?.companyDisplayName).toBe("Brand B");

    const byInvoiceCount = sortCompanyPerformanceRows(aggregated, "invoiceCount", "desc");
    expect(byInvoiceCount[0]?.companyId).toBe(COMPANY_A);
    expect(byInvoiceCount[0]?.invoiceCount).toBe(2);

    const page = paginateCompanyPerformanceRows(byCompany, 1, 1);
    expect(page.totalCount).toBe(2);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.companyDisplayName).toBe("Brand A");
  });
});

describe("company performance UI authorization / scope (TASK-083)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "report.view").allowed).toBe(true);
  });

  it("shows Company performance nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/companies",
    );
    expect(item?.label).toBe("Company performance");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/companies"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups.flatMap((group) => group.items).some((entry) => entry.href === "/reports/companies"),
    ).toBe(true);
  });

  it("scopes Staff to assigned companies and denies unassigned company filter", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);

    const result = await getCompanyPerformance(
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
      expect(result.error).toBe(COMPANY_PERFORMANCE_FORBIDDEN);
    }
  });

  it("passes visibleToStaffUserId for Staff report loads", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    let seenVisible: string | null | undefined;
    const result = await getCompanyPerformance(
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
      expect(result.data.rows[0]?.companyId).toBe(COMPANY_A);
    }
  });

  it("uses reporting group only to narrow owning-company scope", async () => {
    const admin = principal("ADMIN");
    let seenCompanyIds: readonly string[] | "ALL" | undefined;
    const result = await getCompanyPerformance(
      admin,
      { reportingGroupId: REPORTING_GROUP },
      {
        store: {
          listCompanyIdsInReportingGroup: async (groupId) => {
            expect(groupId).toBe(REPORTING_GROUP);
            return [COMPANY_A, COMPANY_B];
          },
          listInvoiceRows: async (filters) => {
            seenCompanyIds = filters.companyIds;
            return [
              sourceInvoice({ companyId: COMPANY_A, companyDisplayName: "Brand A" }),
              sourceInvoice({
                id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
                companyId: COMPANY_B,
                companyDisplayName: "Brand B",
              }),
            ];
          },
          listPaymentRows: async () => [],
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(seenCompanyIds).toEqual([COMPANY_A, COMPANY_B]);
    if (result.ok) {
      expect(result.data.rows.every((row) => row.companyId !== REPORTING_GROUP)).toBe(true);
      expect(result.data.rows.map((row) => row.companyId).sort()).toEqual(
        [COMPANY_A, COMPANY_B].sort(),
      );
    }
  });

  it("parses search params for company performance filters", () => {
    const parsed = parseCompanyPerformanceSearchParams({
      companyId: COMPANY_A,
      settlementCurrency: "aed",
      paymentMethod: "STRIPE",
      sortBy: "invoiceCount",
      sortDir: "desc",
    });
    expect(parsed.companyId).toBe(COMPANY_A);
    expect(parsed.settlementCurrency).toBe("AED");
    expect(parsed.paymentMethod).toBe("STRIPE");
    expect(parsed.sortBy).toBe("invoiceCount");
    expect(parsed.sortDir).toBe("desc");
  });
});
