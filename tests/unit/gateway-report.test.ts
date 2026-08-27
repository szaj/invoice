import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import { authorizePermission } from "@/domain/authz/authorize";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assertGatewayReportFeesSeparateFromSettlement,
  assertGatewayReportHasNoUnlabeledMixedTotal,
  buildGatewayReportRows,
  paginateGatewayReportRows,
  sortGatewayReportRows,
} from "@/domain/reporting/gateway-report";
import { parseGatewayReportSearchParams } from "@/domain/reporting/schema";
import {
  GATEWAY_REPORT_FORBIDDEN,
  type GatewayReportSourcePayment,
  type GatewayReportSourceRefund,
} from "@/domain/reporting/types";
import { getGatewayReport } from "@/server/reporting/gateway-report-service";

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

function sourcePayment(
  overrides: Partial<GatewayReportSourcePayment> = {},
): GatewayReportSourcePayment {
  return {
    id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
    companyId: COMPANY_A,
    invoiceId: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
    customerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    methodCode: "STRIPE",
    status: "SUCCESSFUL",
    complianceStatus: "NOT_REVIEWED",
    invoiceCurrencyCode: "USD",
    settlementCurrencyCode: "AED",
    convertedSettlementAmount: "100.00",
    processorFeeAmount: "5.00",
    actualReceivedAmount: "95.00",
    paymentDate: new Date("2026-01-02T00:00:00.000Z"),
    invoiceCreatedByUserId: null,
    invoiceAssignedStaffUserId: null,
    settlementDecimalPrecision: 2,
    ...overrides,
  };
}

function sourceRefund(
  overrides: Partial<GatewayReportSourceRefund> = {},
): GatewayReportSourceRefund {
  return {
    id: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr",
    companyId: COMPANY_A,
    paymentId: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
    methodCode: "STRIPE",
    settlementCurrencyCode: "AED",
    refundAmount: "10.00",
    effectiveDate: new Date("2026-01-10T00:00:00.000Z"),
    settlementDecimalPrecision: 2,
    ...overrides,
  };
}

describe("gateway report aggregation (TASK-085)", () => {
  it("aggregates transactions, settlement, fees, failures, and refunds by gateway × settlement currency", () => {
    const payments = [
      sourcePayment(),
      sourcePayment({
        id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp2",
        convertedSettlementAmount: "50.00",
        processorFeeAmount: "2.00",
        actualReceivedAmount: null,
      }),
      sourcePayment({
        id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp3",
        status: "FAILED",
        convertedSettlementAmount: "20.00",
        processorFeeAmount: null,
        actualReceivedAmount: null,
      }),
      sourcePayment({
        id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp4",
        methodCode: "PAYPAL",
        settlementCurrencyCode: "USD",
        convertedSettlementAmount: "30.00",
        processorFeeAmount: "1.00",
        actualReceivedAmount: "29.00",
      }),
    ];
    const refunds = [
      sourceRefund(),
      sourceRefund({
        id: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrr2",
        methodCode: "PAYPAL",
        settlementCurrencyCode: "USD",
        refundAmount: "5.00",
      }),
    ];

    const rows = buildGatewayReportRows(payments, refunds);
    assertGatewayReportHasNoUnlabeledMixedTotal(rows);
    assertGatewayReportFeesSeparateFromSettlement(rows, payments);

    expect(rows).toHaveLength(2);

    const stripeAed = rows.find(
      (row) => row.methodCode === "STRIPE" && row.settlementCurrencyCode === "AED",
    );
    expect(stripeAed).toMatchObject({
      transactionCount: 2,
      failureCount: 1,
      convertedSettlement: "150",
      processorFees: "7",
      actualReceived: "95",
      refundCount: 1,
      refunds: "10",
    });

    const paypalUsd = rows.find(
      (row) => row.methodCode === "PAYPAL" && row.settlementCurrencyCode === "USD",
    );
    expect(paypalUsd).toMatchObject({
      transactionCount: 1,
      failureCount: 0,
      convertedSettlement: "30",
      processorFees: "1",
      actualReceived: "29",
      refundCount: 1,
      refunds: "5",
    });
  });

  it("does not deduct processor fees from converted settlement (fee separation)", () => {
    const payments = [
      sourcePayment({
        convertedSettlementAmount: "100.00",
        processorFeeAmount: "5.00",
        actualReceivedAmount: "95.00",
      }),
    ];
    const rows = buildGatewayReportRows(payments, []);
    assertGatewayReportFeesSeparateFromSettlement(rows, payments);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.convertedSettlement).toBe("100");
    expect(rows[0]?.processorFees).toBe("5");
    expect(rows[0]?.actualReceived).toBe("95");
    // Explicit: settlement is not settlement − fee
    expect(rows[0]?.convertedSettlement).not.toBe("95");
  });

  it("never exposes an unlabeled mixed-currency total", () => {
    const rows = buildGatewayReportRows(
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
      [],
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => Boolean(row.settlementCurrencyCode))).toBe(true);
    expect(rows[0]).not.toHaveProperty("grandTotal");
    expect(rows[0]).not.toHaveProperty("totalSettlement");
    assertGatewayReportHasNoUnlabeledMixedTotal(rows);
  });

  it("sorts and paginates gateway rows", () => {
    const aggregated = buildGatewayReportRows(
      [
        sourcePayment({ methodCode: "STRIPE", settlementCurrencyCode: "USD" }),
        sourcePayment({
          id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp2",
          methodCode: "PAYPAL",
          settlementCurrencyCode: "AED",
          convertedSettlementAmount: "200.00",
        }),
        sourcePayment({
          id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp3",
          methodCode: "MANUAL",
          settlementCurrencyCode: "EUR",
          convertedSettlementAmount: "10.00",
          status: "FAILED",
        }),
      ],
      [],
    );

    const byGateway = sortGatewayReportRows(aggregated, "gateway", "asc");
    expect(byGateway.map((row) => row.methodCode)).toEqual(["MANUAL", "PAYPAL", "STRIPE"]);

    const bySettlement = sortGatewayReportRows(aggregated, "convertedSettlement", "desc");
    expect(bySettlement[0]?.methodCode).toBe("PAYPAL");

    const page = paginateGatewayReportRows(byGateway, 1, 2);
    expect(page.totalCount).toBe(3);
    expect(page.rows).toHaveLength(2);
  });
});

describe("gateway report UI authorization / scope (TASK-085)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);

    expect(authorizePermission(principal("ADMIN"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("COMPLIANCE"), "report.view").allowed).toBe(true);
    expect(authorizePermission(principal("STAFF"), "report.view").allowed).toBe(true);
  });

  it("shows Gateway report nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/gateways",
    );
    expect(item?.label).toBe("Gateway report");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/gateways"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups.flatMap((group) => group.items).some((entry) => entry.href === "/reports/gateways"),
    ).toBe(true);
  });

  it("scopes Staff to assigned companies and denies unassigned company filter", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);

    const result = await getGatewayReport(
      staff,
      { companyId: COMPANY_B },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listPaymentRows: async () => [],
          listRefundRows: async () => [],
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(GATEWAY_REPORT_FORBIDDEN);
    }
  });

  it("passes visibleToStaffUserId for Staff report loads", async () => {
    const staff = principal("STAFF", [COMPANY_A]);
    let seenVisible: string | null | undefined;
    const result = await getGatewayReport(
      staff,
      { companyId: COMPANY_A },
      {
        store: {
          listCompanyIdsInReportingGroup: async () => [],
          listPaymentRows: async (filters) => {
            seenVisible = filters.visibleToStaffUserId;
            return [sourcePayment()];
          },
          listRefundRows: async () => [sourceRefund()],
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(seenVisible).toBe(staff.userId);
    if (result.ok) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]?.methodCode).toBe("STRIPE");
      expect(result.data.rows[0]?.convertedSettlement).toBe("100");
      expect(result.data.rows[0]?.processorFees).toBe("5");
    }
  });

  it("parses search params for gateway report filters", () => {
    const parsed = parseGatewayReportSearchParams({
      companyId: COMPANY_A,
      settlementCurrency: "aed",
      paymentMethod: "STRIPE",
      sortBy: "transactionCount",
      sortDir: "desc",
    });
    expect(parsed.companyId).toBe(COMPANY_A);
    expect(parsed.settlementCurrency).toBe("AED");
    expect(parsed.paymentMethod).toBe("STRIPE");
    expect(parsed.sortBy).toBe("transactionCount");
    expect(parsed.sortDir).toBe("desc");
  });
});
