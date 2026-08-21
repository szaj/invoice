import { describe, expect, it } from "vitest";

import {
  assertFinancialSummaryHasNoUnlabeledMixedTotal,
  buildCustomerFinancialSummary,
  type CustomerFinancialSummaryInvoiceInput,
} from "@/domain/customers/financial-summary";
import { toProfileFinancialSummary } from "@/domain/customers/profile";
import { MONEY_MIXED_CURRENCY } from "@/domain/money/types";
import { assertSameCurrencyCodes } from "@/domain/money/outstanding";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const AS_OF = new Date("2026-08-21T12:00:00.000Z");

function row(
  overrides: Partial<CustomerFinancialSummaryInvoiceInput> &
    Pick<CustomerFinancialSummaryInvoiceInput, "invoiceTotal">,
): CustomerFinancialSummaryInvoiceInput {
  return {
    companyId: COMPANY_A,
    currencyCode: "USD",
    confirmedApplications: [],
    dueDate: null,
    cancelled: false,
    includeInSummary: true,
    decimalPrecision: 2,
    ...overrides,
  };
}

describe("buildCustomerFinancialSummary", () => {
  it("aggregates single-currency totals with outstanding and overdue", () => {
    const summary = buildCustomerFinancialSummary(
      [
        row({
          invoiceTotal: "100.00",
          confirmedApplications: ["40.00"],
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
        }),
        row({
          invoiceTotal: "50.00",
          confirmedApplications: ["50.00"],
          dueDate: new Date("2026-07-01T00:00:00.000Z"),
        }),
        row({
          invoiceTotal: "25.00",
          confirmedApplications: [],
          dueDate: new Date("2026-09-01T00:00:00.000Z"),
        }),
      ],
      { asOf: AS_OF },
    );

    expect(summary.byCurrency).toHaveLength(1);
    expect(summary.byCurrency[0]).toEqual({
      currencyCode: "USD",
      totalInvoiced: "175",
      totalPaid: "90",
      outstanding: "85",
      overdue: "60",
    });
    assertFinancialSummaryHasNoUnlabeledMixedTotal(summary);
  });

  it("keeps mixed currencies in separate buckets and never one unlabeled total", () => {
    const summary = buildCustomerFinancialSummary(
      [
        row({ currencyCode: "USD", invoiceTotal: "100.00", confirmedApplications: ["10.00"] }),
        row({ currencyCode: "AED", invoiceTotal: "200.00", confirmedApplications: ["50.00"] }),
        row({
          currencyCode: "usd",
          invoiceTotal: "20.00",
          confirmedApplications: ["5.00"],
        }),
      ],
      { asOf: AS_OF },
    );

    expect(summary.byCurrency.map((b) => b.currencyCode)).toEqual(["AED", "USD"]);
    expect(summary.byCurrency.find((b) => b.currencyCode === "USD")).toEqual({
      currencyCode: "USD",
      totalInvoiced: "120",
      totalPaid: "15",
      outstanding: "105",
      overdue: "0",
    });
    expect(summary.byCurrency.find((b) => b.currencyCode === "AED")).toEqual({
      currencyCode: "AED",
      totalInvoiced: "200",
      totalPaid: "50",
      outstanding: "150",
      overdue: "0",
    });

    expect(() => assertSameCurrencyCodes(summary.byCurrency.map((b) => b.currencyCode))).toThrow(
      MONEY_MIXED_CURRENCY,
    );

    // Presentation helper still exposes only by-currency buckets.
    const presented = toProfileFinancialSummary(summary.byCurrency, true);
    expect(presented.status).toBe("ready");
    if (presented.status === "ready") {
      expect(presented.byCurrency).toHaveLength(2);
      expect(presented).not.toHaveProperty("grandTotal");
      expect(presented).not.toHaveProperty("total");
    }
  });

  it("excludes cancelled/draft rows and applies company filter", () => {
    const summary = buildCustomerFinancialSummary(
      [
        row({
          companyId: COMPANY_A,
          currencyCode: "USD",
          invoiceTotal: "100.00",
        }),
        row({
          companyId: COMPANY_B,
          currencyCode: "USD",
          invoiceTotal: "999.00",
        }),
        row({
          companyId: COMPANY_A,
          currencyCode: "USD",
          invoiceTotal: "50.00",
          cancelled: true,
        }),
        row({
          companyId: COMPANY_A,
          currencyCode: "USD",
          invoiceTotal: "75.00",
          includeInSummary: false,
        }),
      ],
      { companyFilterId: COMPANY_A, asOf: AS_OF },
    );

    expect(summary.byCurrency).toEqual([
      {
        currencyCode: "USD",
        totalInvoiced: "100",
        totalPaid: "0",
        outstanding: "100",
        overdue: "0",
      },
    ]);
  });

  it("marks empty source presentation without inventing amounts", () => {
    const empty = toProfileFinancialSummary([], false);
    expect(empty.status).toBe("empty");
    expect(empty.byCurrency).toEqual([]);
    expect(empty.sourceAvailable).toBe(false);
  });
});
