import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assertReportingGroupRollupHasNoUnlabeledMixedTotal,
  assertReportingGroupRollupOwnershipIsMemberCompany,
  buildReportingGroupRollupRows,
} from "@/domain/reporting/reporting-group-rollup";
import { parseReportingGroupRollupSearchParams } from "@/domain/reporting/schema";
import {
  REPORTING_GROUP_ROLLUP_FORBIDDEN,
  type ReportingGroupRollupSourceGroup,
  type ReportingGroupRollupSourceInvoice,
  type ReportingGroupRollupSourcePayment,
} from "@/domain/reporting/types";
import { getReportingGroupRollups } from "@/server/reporting/reporting-group-rollup-service";
import type { ReportingGroupRollupServiceDependencies } from "@/server/reporting/reporting-group-rollup-service";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const REPORTING_GROUP = "33333333-3333-4333-8333-333333333333";

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

const group: ReportingGroupRollupSourceGroup = {
  id: REPORTING_GROUP,
  name: "VX Group",
  code: "VX",
  companies: [
    { id: COMPANY_A, displayName: "Brand A" },
    { id: COMPANY_B, displayName: "Brand B" },
  ],
};

function sourceInvoice(
  overrides: Partial<ReportingGroupRollupSourceInvoice> = {},
): ReportingGroupRollupSourceInvoice {
  return {
    id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    companyId: COMPANY_A,
    companyDisplayName: "Brand A",
    reportingGroupId: REPORTING_GROUP,
    customerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    currencyCode: "USD",
    status: "ISSUED",
    complianceStatus: "NOT_REVIEWED",
    invoiceTotal: "100.00",
    confirmedPaidAmount: "50.00",
    outstandingAmount: "50.00",
    dueDate: new Date("2026-02-01T00:00:00.000Z"),
    invoiceDate: new Date("2026-01-15T00:00:00.000Z"),
    assignedStaffUserId: null,
    createdByUserId: null,
    decimalPrecision: 2,
    ...overrides,
  };
}

function sourcePayment(
  overrides: Partial<ReportingGroupRollupSourcePayment> = {},
): ReportingGroupRollupSourcePayment {
  return {
    id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
    companyId: COMPANY_A,
    companyDisplayName: "Brand A",
    reportingGroupId: REPORTING_GROUP,
    invoiceId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    customerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    methodCode: "STRIPE",
    status: "SUCCESSFUL",
    complianceStatus: "NOT_REVIEWED",
    invoiceCurrencyCode: "USD",
    invoiceAmountApplied: "50.00",
    settlementCurrencyCode: "USD",
    convertedSettlementAmount: "50.00",
    processorFeeAmount: null,
    actualReceivedAmount: null,
    paymentDate: new Date("2026-01-20T00:00:00.000Z"),
    invoiceCreatedByUserId: null,
    invoiceAssignedStaffUserId: null,
    invoiceDecimalPrecision: 2,
    settlementDecimalPrecision: 2,
    ...overrides,
  };
}

describe("reporting group rollup aggregation (TASK-089)", () => {
  it("builds KPI and matrix summary rows keyed by reporting group", () => {
    const invoices = [
      sourceInvoice(),
      sourceInvoice({
        id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
        companyId: COMPANY_B,
        companyDisplayName: "Brand B",
      }),
    ];
    const payments = [
      sourcePayment(),
      sourcePayment({
        id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp2",
        companyId: COMPANY_B,
        companyDisplayName: "Brand B",
        convertedSettlementAmount: "25.00",
        paymentDate: new Date("2026-02-10T00:00:00.000Z"),
      }),
    ];

    const rows = buildReportingGroupRollupRows({
      groups: [group],
      invoices,
      payments,
      matrixPayments: payments,
      matrixAdjustments: [],
      fixedRates: [],
      year: 2026,
      reportingCurrencyCode: "USD",
      decimalPrecision: 2,
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.reportingGroupId).toBe(REPORTING_GROUP);
    expect(rows[0]?.companyIds).toEqual([COMPANY_A, COMPANY_B]);
    expect(rows[0]?.invoiceCount).toBe(2);
    expect(rows[0]?.paymentCount).toBe(2);
    expect(rows[0]?.invoiceCurrencies[0]?.totalInvoiced).toBe("200");
    expect(rows[0]?.matrixSummary?.annualGross).toBe("75");
    assertReportingGroupRollupHasNoUnlabeledMixedTotal(rows);
    assertReportingGroupRollupOwnershipIsMemberCompany(rows, [COMPANY_A, COMPANY_B]);
  });

  it("never treats reporting group id as transaction owner", () => {
    const rows = buildReportingGroupRollupRows({
      groups: [group],
      invoices: [sourceInvoice()],
      payments: [],
      matrixPayments: [],
      matrixAdjustments: [],
      fixedRates: [],
      year: 2026,
      reportingCurrencyCode: "USD",
      decimalPrecision: 2,
    });

    expect(rows[0]?.reportingGroupId).not.toBe(COMPANY_A);
    expect(() =>
      assertReportingGroupRollupOwnershipIsMemberCompany(rows, [REPORTING_GROUP]),
    ).toThrow(/transaction-owning company/i);
  });
});

describe("reporting group rollup authorization (TASK-089)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);
  });

  it("shows reporting group rollups nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/reporting-groups",
    );
    expect(item?.label).toBe("Reporting group rollups");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/reporting-groups"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups
        .flatMap((group) => group.items)
        .some((entry) => entry.href === "/reports/reporting-groups"),
    ).toBe(true);
  });

  it("denies unassigned company scope for Compliance/Staff", () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);
  });

  it("returns forbidden from service for unauthenticated actors", async () => {
    const result = await getReportingGroupRollups(null, { year: 2026 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(REPORTING_GROUP_ROLLUP_FORBIDDEN);
    }
  });

  it("Staff cannot roll up unassigned companies via a reporting group", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    let seenCompanyIds: readonly string[] | "ALL" | undefined;

    const result = await getReportingGroupRollups(
      staff,
      { reportingGroupId: REPORTING_GROUP, year: 2026 },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [COMPANY_A, COMPANY_B],
          listReportingGroupsInScope: async (companyIds) => {
            seenCompanyIds = companyIds;
            if (companyIds === "ALL") {
              return [group];
            }
            return [
              {
                ...group,
                companies: group.companies.filter((company) => companyIds.includes(company.id)),
              },
            ];
          },
          listInvoiceRows: async () => [sourceInvoice()],
          listPaymentRows: async () => [sourcePayment()],
          listMatrixPaymentRows: async () => [sourcePayment()],
          listMatrixAdjustmentRows: async () => [],
          loadReportingCurrencyPrecision: async () => 2,
        },
        settingsStore: {
          getSettings: async () =>
            ({
              reportingCurrencyCode: "USD",
            }) as Awaited<
              ReturnType<ReportingGroupRollupServiceDependencies["settingsStore"]["getSettings"]>
            >,
        },
        fixedRateStore: {
          listRates: async () => [],
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(seenCompanyIds).toEqual([COMPANY_A]);
    if (result.ok) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]?.companyIds).toEqual([COMPANY_A]);
      expect(result.data.rows[0]?.companyCount).toBe(1);
    }
  });

  it("parses search params including reporting group and year", () => {
    const parsed = parseReportingGroupRollupSearchParams({
      year: "2026",
      reportingGroupId: REPORTING_GROUP,
      companyId: COMPANY_A,
      settlementCurrency: "aed",
    });
    expect(parsed.year).toBe(2026);
    expect(parsed.reportingGroupId).toBe(REPORTING_GROUP);
    expect(parsed.companyId).toBe(COMPANY_A);
    expect(parsed.settlementCurrency).toBe("AED");
  });
});
