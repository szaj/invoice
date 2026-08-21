import { describe, expect, it } from "vitest";

import { computeInvoiceTotals } from "@/domain/invoices/totals";

describe("computeInvoiceTotals", () => {
  it("computes subtotal, tax, invoice total, and outstanding with zero payments", () => {
    const totals = computeInvoiceTotals({
      currencyCode: "USD",
      decimalPrecision: 2,
      lineItems: [
        { lineTotal: "300.00", taxRatePercent: "5" },
        { lineTotal: "120.00", taxRatePercent: null },
      ],
      confirmedApplications: [],
    });

    expect(totals.subtotal).toBe("420");
    expect(totals.discountTotal).toBe("0");
    // 300 × 5% = 15; second line no tax
    expect(totals.taxTotal).toBe("15");
    expect(totals.invoiceTotal).toBe("435");
    expect(totals.confirmedPaidAmount).toBe("0");
    expect(totals.outstandingAmount).toBe("435");
    expect(totals.isSettledWithinTolerance).toBe(false);
  });

  it("keeps discount total at zero while ADR-010 is open", () => {
    const totals = computeInvoiceTotals({
      currencyCode: "AED",
      decimalPrecision: 2,
      lineItems: [{ lineTotal: "100.00", taxRatePercent: null }],
    });
    expect(totals.discountTotal).toBe("0");
    expect(totals.invoiceTotal).toBe("100");
  });

  it("reduces outstanding from confirmed applications (BR-009)", () => {
    const totals = computeInvoiceTotals({
      currencyCode: "USD",
      decimalPrecision: 2,
      lineItems: [{ lineTotal: "100.00", taxRatePercent: "0" }],
      confirmedApplications: ["40.00", "25.00"],
    });
    expect(totals.invoiceTotal).toBe("100");
    expect(totals.confirmedPaidAmount).toBe("65");
    expect(totals.outstandingAmount).toBe("35");
  });

  it("rejects JavaScript number money inputs", () => {
    expect(() =>
      computeInvoiceTotals({
        currencyCode: "USD",
        decimalPrecision: 2,
        lineItems: [{ lineTotal: 100 as unknown as string, taxRatePercent: null }],
      }),
    ).toThrow(/JavaScript number/);
  });
});
