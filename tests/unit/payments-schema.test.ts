import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { computeConvertedSettlementAmount } from "@/domain/money/convert";
import {
  assertPaymentFinancialFieldsMutable,
  assertPaymentHardDeleteAllowed,
  assertProcessorFeeExcludedFromSettlement,
} from "@/domain/payments/invariants";
import { paymentCreatePendingSchema, paymentWriteSchema } from "@/domain/payments/schema";
import {
  PAYMENT_CONFIRMED_IMMUTABLE,
  PAYMENT_HARD_DELETE_FORBIDDEN,
  PAYMENT_JS_NUMBER_FORBIDDEN,
} from "@/domain/payments/types";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";

const validWrite = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  companyId: COMPANY_ID,
  invoiceId: INVOICE_ID,
  customerId: CUSTOMER_ID,
  methodCode: "MANUAL",
  invoiceCurrencyCode: "GBP",
  invoiceAmountApplied: "100.00",
  settlementCurrencyCode: "USD",
  fixedConversionRate: "1.250000000000",
  rateSource: "ADMIN_FIXED_RATE",
  convertedSettlementAmount: "125.00",
  paymentDate: "2026-08-21",
  source: "MANUAL",
  ...overrides,
});

describe("payment domain schema (TASK-044)", () => {
  it("requires company, invoice, and customer", () => {
    expect(paymentWriteSchema.safeParse({}).success).toBe(false);
    expect(paymentWriteSchema.safeParse(validWrite({ companyId: undefined })).success).toBe(false);
    expect(paymentWriteSchema.safeParse(validWrite({ invoiceId: undefined })).success).toBe(false);
    expect(paymentWriteSchema.safeParse(validWrite({ customerId: undefined })).success).toBe(false);
  });

  it("accepts provider-agnostic method codes and Pending/Successful/Failed statuses", () => {
    for (const methodCode of ["STRIPE", "PAYPAL", "BANK_PROCESSOR", "MANUAL"] as const) {
      const parsed = paymentWriteSchema.safeParse(validWrite({ methodCode }));
      expect(parsed.success).toBe(true);
    }
    for (const status of ["PENDING", "SUCCESSFUL", "FAILED"] as const) {
      const parsed = paymentWriteSchema.safeParse(validWrite({ status }));
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects JavaScript numbers for authoritative money fields", () => {
    const withNumber = paymentWriteSchema.safeParse(
      validWrite({ invoiceAmountApplied: 100 as unknown as string }),
    );
    expect(withNumber.success).toBe(false);
    if (!withNumber.success) {
      const messages = withNumber.error.issues.map((issue) => issue.message);
      expect(messages.some((message) => message === PAYMENT_JS_NUMBER_FORBIDDEN)).toBe(true);
    }

    const feeNumber = paymentWriteSchema.safeParse(
      validWrite({ processorFeeAmount: 5.5 as unknown as string }),
    );
    expect(feeNumber.success).toBe(false);
  });

  it("stores fee separately from converted settlement (BR-020)", () => {
    const converted = computeConvertedSettlementAmount({
      invoiceAmountApplied: "100.00",
      invoiceCurrencyCode: "GBP",
      settlementCurrencyCode: "USD",
      fixedConversionRate: "1.25",
      settlementDecimalPrecision: 2,
      processorFee: "9.99",
    });

    const parsed = paymentWriteSchema.safeParse(
      validWrite({
        convertedSettlementAmount: converted.convertedSettlementAmount.amount,
        processorFeeAmount: "9.99",
        actualReceivedAmount: "115.01",
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("expected success");
    }
    expect(parsed.data.convertedSettlementAmount).toBe("125");
    expect(parsed.data.processorFeeAmount).toBe("9.99");
    expect(parsed.data.actualReceivedAmount).toBe("115.01");
    expect(parsed.data.convertedSettlementAmount).not.toBe("115.01");

    const withSnapshot = paymentWriteSchema.safeParse(
      validWrite({
        rateVersionId: "99999999-9999-4999-8999-999999999999",
        rateEffectiveAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(withSnapshot.success).toBe(true);
    if (!withSnapshot.success) {
      throw new Error("expected snapshot fields to parse");
    }
    expect(withSnapshot.data.rateVersionId).toBe("99999999-9999-4999-8999-999999999999");
    expect(withSnapshot.data.rateEffectiveAt?.toISOString()).toBe("2026-01-01T00:00:00.000Z");

    assertProcessorFeeExcludedFromSettlement(
      {
        invoiceAmountApplied: parsed.data.invoiceAmountApplied,
        invoiceCurrencyCode: parsed.data.invoiceCurrencyCode,
        settlementCurrencyCode: parsed.data.settlementCurrencyCode,
        fixedConversionRate: parsed.data.fixedConversionRate,
        convertedSettlementAmount: parsed.data.convertedSettlementAmount,
        processorFeeAmount: parsed.data.processorFeeAmount,
      },
      2,
    );
  });

  it("locks confirmed financial fields and forbids hard-delete of successful payments", () => {
    expect(() => assertPaymentFinancialFieldsMutable("SUCCESSFUL")).toThrow(
      PAYMENT_CONFIRMED_IMMUTABLE,
    );
    expect(() => assertPaymentFinancialFieldsMutable("PENDING")).not.toThrow();
    expect(() => assertPaymentHardDeleteAllowed("SUCCESSFUL")).toThrow(
      PAYMENT_HARD_DELETE_FORBIDDEN,
    );
    expect(() => assertPaymentHardDeleteAllowed("FAILED")).not.toThrow();
  });

  it("does not include Stripe-/PayPal-only columns in the Prisma Payment model", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const paymentBlock = schema.slice(
      schema.indexOf("model Payment {"),
      schema.indexOf('@@map("payments")'),
    );
    expect(paymentBlock).toContain("methodCode");
    expect(paymentBlock).toContain("externalTransactionId");
    expect(paymentBlock).toContain("processorFeeAmount");
    expect(paymentBlock).toContain("rateEffectiveAt");
    expect(paymentBlock).toContain("rateVersionId");
    expect(paymentBlock).not.toMatch(/stripePaymentIntent/i);
    expect(paymentBlock).not.toMatch(/paypalOrder/i);
    expect(paymentBlock).not.toMatch(/secretKey|apiKey|webhookSecret/i);
  });
});

describe("payment create-pending schema (TASK-045)", () => {
  it("does not accept client-supplied rates, company, or converted settlement", () => {
    const parsed = paymentCreatePendingSchema.safeParse({
      invoiceId: INVOICE_ID,
      methodCode: "MANUAL",
      invoiceAmountApplied: "10.00",
      settlementCurrencyCode: "USD",
      paymentDate: "2026-08-24",
      companyId: COMPANY_ID,
      fixedConversionRate: "2",
      convertedSettlementAmount: "20",
    });
    expect(parsed.success).toBe(false);
  });
});
