import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assertCurrencyReportFeesSeparateFromSettlement,
  assertCurrencyReportHasNoUnlabeledMixedTotal,
  buildCurrencyReport,
} from "@/domain/reporting/currency-report";
import { parseCurrencyReportSearchParams } from "@/domain/reporting/schema";
import {
  CURRENCY_REPORT_FORBIDDEN,
  type CurrencyReportSourceInvoice,
  type CurrencyReportSourcePayment,
} from "@/domain/reporting/types";
import { getCurrencyReport } from "@/server/reporting/currency-report-service";

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

function sourceInvoice(
  overrides: Partial<CurrencyReportSourceInvoice> = {},
): CurrencyReportSourceInvoice {
  return {
    id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    companyId: COMPANY_A,
    customerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    currencyCode: "USD",
    status: "ISSUED",
    complianceStatus: "NOT_REVIEWED",
    invoiceTotal: "100.00",
    confirmedPaidAmount: "0.00",
    outstandingAmount: "100.00",
    dueDate: new Date("2026-02-01T00:00:00.000Z"),
    invoiceDate: new Date("2026-01-01T00:00:00.000Z"),
    assignedStaffUserId: null,
    createdByUserId: null,
    decimalPrecision: 2,
    ...overrides,
  };
}

function sourcePayment(
  overrides: Partial<CurrencyReportSourcePayment> = {},
): CurrencyReportSourcePayment {
  return {
    id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
    companyId: COMPANY_A,
    invoiceId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    customerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    methodCode: "STRIPE",
    status: "SUCCESSFUL",
    complianceStatus: "NOT_REVIEWED",
    invoiceCurrencyCode: "USD",
    invoiceAmountApplied: "40.00",
    settlementCurrencyCode: "AED",
    convertedSettlementAmount: "100.00",
    processorFeeAmount: "5.00",
    actualReceivedAmount: "95.00",
    paymentDate: new Date("2026-01-02T00:00:00.000Z"),
    invoiceCreatedByUserId: null,
    invoiceAssignedStaffUserId: null,
    invoiceDecimalPrecision: 2,
    settlementDecimalPrecision: 2,
    ...overrides,
  };
}

describe("currency report aggregation (TASK-086)", () => {
  it("keeps separate currency totals for invoice and settlement currencies", () => {
    const invoices = [
      sourceInvoice({ currencyCode: "USD", invoiceTotal: "100.00", outstandingAmount: "60.00" }),
      sourceInvoice({
        id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
        currencyCode: "EUR",
        invoiceTotal: "50.00",
        outstandingAmount: "50.00",
      }),
      sourceInvoice({
        id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii3",
        currencyCode: "USD",
        invoiceTotal: "25.00",
        outstandingAmount: "25.00",
      }),
    ];
    const payments = [
      sourcePayment({
        invoiceCurrencyCode: "USD",
        invoiceAmountApplied: "40.00",
        settlementCurrencyCode: "AED",
        convertedSettlementAmount: "100.00",
        processorFeeAmount: "5.00",
        actualReceivedAmount: "95.00",
      }),
      sourcePayment({
        id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp2",
        invoiceCurrencyCode: "EUR",
        invoiceAmountApplied: "10.00",
        settlementCurrencyCode: "USD",
        convertedSettlementAmount: "30.00",
        processorFeeAmount: "1.00",
        actualReceivedAmount: "29.00",
      }),
      sourcePayment({
        id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp3",
        invoiceCurrencyCode: "USD",
        invoiceAmountApplied: "15.00",
        settlementCurrencyCode: "AED",
        convertedSettlementAmount: "50.00",
        processorFeeAmount: "2.00",
        actualReceivedAmount: null,
      }),
    ];

    const report = buildCurrencyReport(invoices, payments, {
      asOf: new Date("2026-01-15T00:00:00.000Z"),
    });
    assertCurrencyReportHasNoUnlabeledMixedTotal(report);
    assertCurrencyReportFeesSeparateFromSettlement(report, payments);

    expect(report.invoiceCurrencies).toHaveLength(2);
    expect(report.settlementCurrencies).toHaveLength(2);

    const usdInvoice = report.invoiceCurrencies.find((row) => row.currencyCode === "USD");
    expect(usdInvoice).toMatchObject({
      totalInvoiced: "125",
      totalPaid: "55",
      outstanding: "85",
    });

    const eurInvoice = report.invoiceCurrencies.find((row) => row.currencyCode === "EUR");
    expect(eurInvoice).toMatchObject({
      totalInvoiced: "50",
      totalPaid: "10",
      outstanding: "50",
    });

    const aedSettlement = report.settlementCurrencies.find((row) => row.currencyCode === "AED");
    expect(aedSettlement).toMatchObject({
      convertedSettlement: "150",
      processorFees: "7",
      actualReceived: "95",
    });

    const usdSettlement = report.settlementCurrencies.find((row) => row.currencyCode === "USD");
    expect(usdSettlement).toMatchObject({
      convertedSettlement: "30",
      processorFees: "1",
      actualReceived: "29",
    });
  });

  it("does not deduct processor fees from converted settlement", () => {
    const payments = [
      sourcePayment({
        convertedSettlementAmount: "100.00",
        processorFeeAmount: "5.00",
        actualReceivedAmount: "95.00",
      }),
    ];
    const report = buildCurrencyReport([], payments);
    assertCurrencyReportFeesSeparateFromSettlement(report, payments);

    expect(report.settlementCurrencies).toHaveLength(1);
    expect(report.settlementCurrencies[0]?.convertedSettlement).toBe("100");
    expect(report.settlementCurrencies[0]?.processorFees).toBe("5");
    expect(report.settlementCurrencies[0]?.convertedSettlement).not.toBe("95");
  });

  it("never collapses currencies without labels (BR-013)", () => {
    const report = buildCurrencyReport(
      [
        sourceInvoice({ currencyCode: "USD" }),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
          currencyCode: "EUR",
          invoiceTotal: "40.00",
          outstandingAmount: "40.00",
        }),
      ],
      [
        sourcePayment({ settlementCurrencyCode: "AED" }),
        sourcePayment({
          id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp2",
          settlementCurrencyCode: "USD",
          convertedSettlementAmount: "40.00",
          processorFeeAmount: null,
          actualReceivedAmount: null,
        }),
      ],
    );

    expect(report.invoiceCurrencies).toHaveLength(2);
    expect(report.settlementCurrencies).toHaveLength(2);
    expect(report.invoiceCurrencies.every((row) => Boolean(row.currencyCode))).toBe(true);
    expect(report.settlementCurrencies.every((row) => Boolean(row.currencyCode))).toBe(true);
    expect(report).not.toHaveProperty("grandTotal");
    expect(report).not.toHaveProperty("totalInvoiced");
    expect(report).not.toHaveProperty("totalSettlement");
    assertCurrencyReportHasNoUnlabeledMixedTotal(report);
  });

  it("sorts currency rows by currency code", () => {
    const reportAsc = buildCurrencyReport(
      [
        sourceInvoice({ currencyCode: "USD" }),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
          currencyCode: "EUR",
        }),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii3",
          currencyCode: "AED",
        }),
      ],
      [],
      { sortDir: "asc" },
    );
    expect(reportAsc.invoiceCurrencies.map((row) => row.currencyCode)).toEqual([
      "AED",
      "EUR",
      "USD",
    ]);

    const reportDesc = buildCurrencyReport(
      [
        sourceInvoice({ currencyCode: "USD" }),
        sourceInvoice({
          id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiii2",
          currencyCode: "EUR",
        }),
      ],
      [],
      { sortDir: "desc" },
    );
    expect(reportDesc.invoiceCurrencies.map((row) => row.currencyCode)).toEqual(["USD", "EUR"]);
  });
});

describe("currency report UI authorization / scope (TASK-086)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "report.view").allowed).toBe(true);
  });

  it("shows Currency report nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/currencies",
    );
    expect(item?.label).toBe("Currency report");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/currencies"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups.flatMap((group) => group.items).some((entry) => entry.href === "/reports/currencies"),
    ).toBe(true);
  });

  it("scopes Staff to assigned companies and denies unassigned company filter", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);

    const result = await getCurrencyReport(
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
      expect(result.error).toBe(CURRENCY_REPORT_FORBIDDEN);
    }
  });

  it("passes visibleToStaffUserId for Staff report loads", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    let seenVisible: string | null | undefined;
    const result = await getCurrencyReport(
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
      expect(result.data.invoiceCurrencies).toHaveLength(1);
      expect(result.data.settlementCurrencies).toHaveLength(1);
      expect(result.data.settlementCurrencies[0]?.convertedSettlement).toBe("100");
      expect(result.data.settlementCurrencies[0]?.processorFees).toBe("5");
    }
  });

  it("parses search params for currency report filters", () => {
    const parsed = parseCurrencyReportSearchParams({
      companyId: COMPANY_A,
      invoiceCurrency: "usd",
      settlementCurrency: "aed",
      sortBy: "currency",
      sortDir: "desc",
    });
    expect(parsed.companyId).toBe(COMPANY_A);
    expect(parsed.invoiceCurrency).toBe("USD");
    expect(parsed.settlementCurrency).toBe("AED");
    expect(parsed.sortBy).toBe("currency");
    expect(parsed.sortDir).toBe("desc");
  });
});
