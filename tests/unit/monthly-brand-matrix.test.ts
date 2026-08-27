import { describe, expect, it } from "vitest";

import { APP_NAV_GROUPS, filterNavGroups } from "@/components/layout/nav-config";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { authorizeCompanyAccess } from "@/domain/authz/company-access";
import { roleHasPermission } from "@/domain/authz/matrix";
import {
  assertMonthlyBrandMatrixUsesReportingCurrency,
  buildMonthlyBrandMatrix,
  utcCalendarMonth,
} from "@/domain/reporting/monthly-brand-matrix";
import { parseMonthlyBrandMatrixSearchParams } from "@/domain/reporting/schema";
import {
  MONTHLY_BRAND_MATRIX_FORBIDDEN,
  type MonthlyBrandMatrixSourceAdjustment,
  type MonthlyBrandMatrixSourceCompany,
  type MonthlyBrandMatrixSourcePayment,
} from "@/domain/reporting/types";
import { getMonthlyBrandMatrix } from "@/server/reporting/monthly-brand-matrix-service";

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

const companies: MonthlyBrandMatrixSourceCompany[] = [
  { id: COMPANY_A, displayName: "Brand A" },
  { id: COMPANY_B, displayName: "Brand B" },
];

function sourcePayment(
  overrides: Partial<MonthlyBrandMatrixSourcePayment> = {},
): MonthlyBrandMatrixSourcePayment {
  return {
    id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
    companyId: COMPANY_A,
    status: "SUCCESSFUL",
    settlementCurrencyCode: "AED",
    convertedSettlementAmount: "100.00",
    paymentDate: new Date("2026-01-15T00:00:00.000Z"),
    settlementDecimalPrecision: 2,
    ...overrides,
  };
}

function sourceAdjustment(
  overrides: Partial<MonthlyBrandMatrixSourceAdjustment> = {},
): MonthlyBrandMatrixSourceAdjustment {
  return {
    id: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    companyId: COMPANY_A,
    paymentId: "pppppppp-pppp-4ppp-8ppp-pppppppppppp",
    type: "REFUND",
    status: "PROCESSED",
    amount: "10.00",
    settlementAmount: "10.00",
    settlementCurrencyCode: "AED",
    effectiveDate: new Date("2026-01-20T00:00:00.000Z"),
    settlementDecimalPrecision: 2,
    ...overrides,
  };
}

describe("monthly brand matrix aggregation (TASK-088)", () => {
  it("builds Jan–Dec rows plus G.Total with brand columns, monthly total, and CB/RF", () => {
    const payments = [
      sourcePayment(),
      sourcePayment({
        id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp2",
        companyId: COMPANY_B,
        convertedSettlementAmount: "50.00",
        paymentDate: new Date("2026-01-10T00:00:00.000Z"),
      }),
      sourcePayment({
        id: "pppppppp-pppp-4ppp-8ppp-ppppppppppp3",
        convertedSettlementAmount: "75.00",
        paymentDate: new Date("2026-02-05T00:00:00.000Z"),
      }),
    ];
    const adjustments = [sourceAdjustment()];

    const { payload } = buildMonthlyBrandMatrix({
      year: 2026,
      reportingCurrencyCode: "AED",
      decimalPrecision: 2,
      companies,
      payments,
      adjustments,
      fixedRates: [],
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    assertMonthlyBrandMatrixUsesReportingCurrency(payload);
    expect(payload.rows).toHaveLength(13);
    expect(payload.rows[0]?.label).toBe("January");
    expect(payload.rows.at(-1)?.label).toBe("G.Total");

    const january = payload.rows.find((row) => row.month === 1);
    expect(january).toMatchObject({
      monthlyTotal: "150",
      cbrf: "10",
      netGTotal: "140",
    });
    expect(january?.companies.find((cell) => cell.companyId === COMPANY_A)?.grossReceipts).toBe(
      "100",
    );
    expect(january?.companies.find((cell) => cell.companyId === COMPANY_B)?.grossReceipts).toBe(
      "50",
    );

    const february = payload.rows.find((row) => row.month === 2);
    expect(february?.monthlyTotal).toBe("75");

    const gTotal = payload.rows.find((row) => row.rowKey === "g-total");
    expect(gTotal).toMatchObject({
      monthlyTotal: "225",
      cbrf: "10",
      netGTotal: "215",
    });
  });

  it("excludes open disputes from CB/RF but reports them in summary (BR-024)", () => {
    const { payload } = buildMonthlyBrandMatrix({
      year: 2026,
      reportingCurrencyCode: "AED",
      decimalPrecision: 2,
      companies,
      payments: [sourcePayment()],
      adjustments: [
        sourceAdjustment({
          id: "ddddddd1-dddd-4ddd-8ddd-dddddddddddd",
          type: "DISPUTE",
          status: "OPEN",
          amount: "25.00",
          settlementAmount: "25.00",
        }),
      ],
      fixedRates: [],
    });

    const january = payload.rows.find((row) => row.month === 1);
    expect(january?.cbrf).toBe("0");
    expect(january?.monthlyTotal).toBe("100");
    expect(payload.summary.openDisputes).toBe("25");
  });

  it("includes processed refunds and chargeback debits in CB/RF with won reversals subtracted", () => {
    const { payload } = buildMonthlyBrandMatrix({
      year: 2026,
      reportingCurrencyCode: "AED",
      decimalPrecision: 2,
      companies,
      payments: [sourcePayment({ convertedSettlementAmount: "200.00" })],
      adjustments: [
        sourceAdjustment({ amount: "20.00", settlementAmount: "20.00" }),
        sourceAdjustment({
          id: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          type: "CHARGEBACK",
          status: "DEBITED",
          amount: "30.00",
          settlementAmount: "30.00",
          effectiveDate: new Date("2026-01-25T00:00:00.000Z"),
        }),
        sourceAdjustment({
          id: "ccccccc1-cccc-4ccc-8ccc-cccccccccccc",
          type: "REVERSAL",
          status: "WON",
          amount: "15.00",
          settlementAmount: "15.00",
          effectiveDate: new Date("2026-01-28T00:00:00.000Z"),
        }),
      ],
      fixedRates: [],
    });

    const january = payload.rows.find((row) => row.month === 1);
    expect(january?.cbrf).toBe("35");
    expect(january?.netGTotal).toBe("165");
  });

  it("preserves drill-down payment and adjustment IDs on matrix cells", () => {
    const payment = sourcePayment();
    const adjustment = sourceAdjustment();

    const { payload } = buildMonthlyBrandMatrix({
      year: 2026,
      reportingCurrencyCode: "AED",
      decimalPrecision: 2,
      companies,
      payments: [payment],
      adjustments: [adjustment],
      fixedRates: [],
    });

    const january = payload.rows.find((row) => row.month === 1);
    const brandCell = january?.companies.find((cell) => cell.companyId === COMPANY_A);
    expect(brandCell?.drillDown.paymentIds).toEqual([payment.id]);
    expect(january?.drillDown.paymentIds).toEqual([payment.id]);
    expect(january?.drillDown.adjustmentIds).toEqual([adjustment.id]);
  });

  it("maps UTC calendar months for payment and effective dates", () => {
    expect(utcCalendarMonth(new Date("2026-12-31T23:59:59.000Z"))).toBe(12);
    expect(utcCalendarMonth(new Date("2026-01-01T00:00:00.000Z"))).toBe(1);
  });
});

describe("monthly brand matrix UI authorization (TASK-088)", () => {
  it("grants report.view to Admin, Compliance, and Staff", () => {
    expect(roleHasPermission("ADMIN", "report.view")).toBe(true);
    expect(roleHasPermission("COMPLIANCE", "report.view")).toBe(true);
    expect(roleHasPermission("STAFF", "report.view")).toBe(true);
  });

  it("shows monthly brand report nav when report.view is allowed", () => {
    const item = APP_NAV_GROUPS.flatMap((group) => group.items).find(
      (entry) => entry.href === "/reports/monthly-brand",
    );
    expect(item?.label).toBe("Monthly brand / CB-RF");
    expect(item?.permissions).toEqual(["report.view"]);

    const allowed = new Set<string>(["/reports/monthly-brand"]);
    const groups = filterNavGroups(allowed);
    expect(
      groups
        .flatMap((group) => group.items)
        .some((entry) => entry.href === "/reports/monthly-brand"),
    ).toBe(true);
  });

  it("denies unassigned company scope for Compliance/Staff", () => {
    const staff = principal("STAFF", [COMPANY_A]);
    expect(authorizeCompanyAccess(staff, COMPANY_A).allowed).toBe(true);
    expect(authorizeCompanyAccess(staff, COMPANY_B).allowed).toBe(false);
    expect(authorizeCompanyAccess(principal("COMPLIANCE", [COMPANY_A]), COMPANY_B).allowed).toBe(
      false,
    );
  });

  it("returns forbidden from service for unauthenticated actors", async () => {
    const result = await getMonthlyBrandMatrix(null, { year: 2026 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(MONTHLY_BRAND_MATRIX_FORBIDDEN);
    }
  });

  it("parses search params including reporting year", () => {
    const parsed = parseMonthlyBrandMatrixSearchParams({
      year: "2026",
      reportingGroupId: "11111111-1111-4111-8111-111111111111",
      settlementCurrency: "aed",
    });
    expect(parsed.year).toBe(2026);
    expect(parsed.reportingGroupId).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed.settlementCurrency).toBe("AED");
  });
});
