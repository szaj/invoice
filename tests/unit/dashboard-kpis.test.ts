import { describe, expect, it } from "vitest";

import {
  assertDashboardHasNoUnlabeledMixedTotal,
  assertFeesNotDeductedFromSettlement,
  buildDashboardKpis,
} from "@/domain/reporting/dashboard-kpis";
import type { DashboardInvoiceRow, DashboardPaymentRow } from "@/domain/reporting/types";
import { parseDashboardKpiSearchParams } from "@/domain/reporting/schema";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_A = "22222222-2222-4222-8222-222222222222";
const INVOICE_A = "33333333-3333-4333-8333-333333333333";
const PAYMENT_A = "44444444-4444-4444-8444-444444444444";
const AS_OF = new Date("2026-08-21T12:00:00.000Z");

function invoice(
  overrides: Partial<DashboardInvoiceRow> &
    Pick<DashboardInvoiceRow, "invoiceTotal" | "outstandingAmount" | "status">,
): DashboardInvoiceRow {
  return {
    id: INVOICE_A,
    companyId: COMPANY_A,
    customerId: CUSTOMER_A,
    currencyCode: "USD",
    complianceStatus: "NOT_REVIEWED",
    confirmedPaidAmount: "0",
    dueDate: new Date("2026-08-01T00:00:00.000Z"),
    invoiceDate: new Date("2026-07-01T00:00:00.000Z"),
    assignedStaffUserId: null,
    createdByUserId: null,
    decimalPrecision: 2,
    ...overrides,
  };
}

function payment(
  overrides: Partial<DashboardPaymentRow> &
    Pick<DashboardPaymentRow, "invoiceAmountApplied" | "convertedSettlementAmount" | "status">,
): DashboardPaymentRow {
  return {
    id: PAYMENT_A,
    companyId: COMPANY_A,
    invoiceId: INVOICE_A,
    customerId: CUSTOMER_A,
    methodCode: "MANUAL",
    complianceStatus: "NOT_REVIEWED",
    invoiceCurrencyCode: "USD",
    settlementCurrencyCode: "AED",
    processorFeeAmount: null,
    actualReceivedAmount: null,
    paymentDate: new Date("2026-08-10T00:00:00.000Z"),
    invoiceCreatedByUserId: null,
    invoiceAssignedStaffUserId: null,
    invoiceDecimalPrecision: 2,
    settlementDecimalPrecision: 2,
    ...overrides,
  };
}

describe("buildDashboardKpis", () => {
  it("aggregates invoice KPIs by original currency and overdue", () => {
    const payload = buildDashboardKpis(
      [
        invoice({
          invoiceTotal: "100.00",
          outstandingAmount: "60.00",
          confirmedPaidAmount: "40.00",
          status: "PARTIALLY_PAID",
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
        }),
        invoice({
          id: "33333333-3333-4333-8333-333333333334",
          currencyCode: "AED",
          invoiceTotal: "200.00",
          outstandingAmount: "200.00",
          status: "ISSUED",
          dueDate: new Date("2026-09-01T00:00:00.000Z"),
        }),
        invoice({
          id: "33333333-3333-4333-8333-333333333335",
          invoiceTotal: "50.00",
          outstandingAmount: "50.00",
          status: "DRAFT",
        }),
      ],
      [],
      { asOf: AS_OF },
    );

    expect(payload.invoiceCurrencies.map((b) => b.currencyCode)).toEqual(["AED", "USD"]);
    expect(payload.invoiceCurrencies.find((b) => b.currencyCode === "USD")).toEqual({
      currencyCode: "USD",
      totalInvoiced: "100",
      totalPaid: "0",
      outstanding: "60",
      overdue: "60",
    });
    expect(payload.invoiceCurrencies.find((b) => b.currencyCode === "AED")).toEqual({
      currencyCode: "AED",
      totalInvoiced: "200",
      totalPaid: "0",
      outstanding: "200",
      overdue: "0",
    });
    expect(payload.invoiceCountsByStatus).toEqual([
      { status: "DRAFT", count: 1 },
      { status: "ISSUED", count: 1 },
      { status: "PARTIALLY_PAID", count: 1 },
    ]);
    assertDashboardHasNoUnlabeledMixedTotal(payload);
  });

  it("uses stored settlement snapshots and keeps fees separate (BR-020)", () => {
    const payload = buildDashboardKpis(
      [
        invoice({
          invoiceTotal: "100.00",
          outstandingAmount: "0",
          confirmedPaidAmount: "100.00",
          status: "PAID",
        }),
      ],
      [
        payment({
          status: "SUCCESSFUL",
          invoiceAmountApplied: "100.00",
          convertedSettlementAmount: "367.00",
          processorFeeAmount: "10.00",
          actualReceivedAmount: "357.00",
        }),
        payment({
          id: "44444444-4444-4444-8444-444444444445",
          status: "PENDING",
          invoiceAmountApplied: "50.00",
          convertedSettlementAmount: "183.50",
          processorFeeAmount: "5.00",
        }),
      ],
      { asOf: AS_OF },
    );

    expect(payload.invoiceCurrencies[0]).toMatchObject({
      currencyCode: "USD",
      totalPaid: "100",
    });
    expect(payload.settlementCurrencies).toEqual([
      {
        currencyCode: "AED",
        convertedSettlement: "367",
        processorFees: "10",
        actualReceived: "357",
      },
    ]);

    assertFeesNotDeductedFromSettlement({
      convertedSettlementAmounts: ["367.00"],
      processorFeeAmounts: ["10.00"],
      reportedConvertedSettlement: payload.settlementCurrencies[0]!.convertedSettlement,
      reportedProcessorFees: payload.settlementCurrencies[0]!.processorFees,
      decimalPrecision: 2,
    });

    // Settlement must not equal converted − fee.
    expect(payload.settlementCurrencies[0]!.convertedSettlement).not.toBe("357");
    expect(payload.paymentCountsByMethodStatus).toEqual([
      { methodCode: "MANUAL", status: "PENDING", count: 1 },
      { methodCode: "MANUAL", status: "SUCCESSFUL", count: 1 },
    ]);
  });

  it("never collapses mixed settlement currencies into one unlabeled total", () => {
    const payload = buildDashboardKpis(
      [],
      [
        payment({
          status: "SUCCESSFUL",
          invoiceAmountApplied: "10.00",
          convertedSettlementAmount: "10.00",
          settlementCurrencyCode: "USD",
          invoiceCurrencyCode: "USD",
        }),
        payment({
          id: "44444444-4444-4444-8444-444444444446",
          status: "SUCCESSFUL",
          invoiceAmountApplied: "20.00",
          convertedSettlementAmount: "73.40",
          settlementCurrencyCode: "AED",
          invoiceCurrencyCode: "USD",
        }),
      ],
      { asOf: AS_OF },
    );

    expect(payload.settlementCurrencies.map((b) => b.currencyCode)).toEqual(["AED", "USD"]);
    assertDashboardHasNoUnlabeledMixedTotal(payload);
  });
});

describe("parseDashboardKpiSearchParams", () => {
  it("parses applicable §13.2 filters", () => {
    const query = parseDashboardKpiSearchParams({
      companyId: COMPANY_A,
      dateFrom: "2026-08-01",
      invoiceCurrency: "usd",
      paymentMethod: "STRIPE",
      countryCode: "ae",
    });
    expect(query.companyId).toBe(COMPANY_A);
    expect(query.dateFrom?.toISOString().startsWith("2026-08-01")).toBe(true);
    expect(query.invoiceCurrency).toBe("USD");
    expect(query.paymentMethod).toBe("STRIPE");
    expect(query.countryCode).toBe("AE");
  });
});
