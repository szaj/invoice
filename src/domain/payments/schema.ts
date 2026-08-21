import { z } from "zod";

import { PAYMENT_METHOD_CODES } from "@/domain/settlement/types";
import {
  PAYMENT_AMOUNT_REQUIRED,
  PAYMENT_COMPANY_REQUIRED,
  PAYMENT_CURRENCY_REQUIRED,
  PAYMENT_CUSTOMER_REQUIRED,
  PAYMENT_INVALID_INPUT,
  PAYMENT_INVOICE_REQUIRED,
  PAYMENT_JS_NUMBER_FORBIDDEN,
  PAYMENT_RATE_SOURCES,
  PAYMENT_SOURCES,
  PAYMENT_STATUSES,
} from "@/domain/payments/types";

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const paymentSourceSchema = z.enum(PAYMENT_SOURCES);
export const paymentRateSourceSchema = z.enum(PAYMENT_RATE_SOURCES);
export const paymentMethodCodeSchema = z.enum(PAYMENT_METHOD_CODES);
export const paymentIdSchema = z.uuid();

function blankToNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const nullableText = (max: number) => z.preprocess(blankToNull, z.string().max(max).nullable());

const currencyCodeSchema = z.preprocess(
  (value) => {
    const next = blankToNull(value);
    return typeof next === "string" ? next.toUpperCase() : next;
  },
  z
    .string({ error: PAYMENT_CURRENCY_REQUIRED })
    .regex(/^[A-Z]{3}$/, "Currency code must be a 3-letter ISO-style code."),
);

const nullableUuid = z.preprocess(blankToNull, z.uuid().nullable());

/** Reject JS number so float never enters authoritative money fields (ADR-004). */
const JS_NUMBER_SENTINEL = "__JS_NUMBER__";

const moneyDecimalStringSchema = (invalidMessage: string) =>
  z.preprocess(
    (value) => {
      if (typeof value === "number") {
        return JS_NUMBER_SENTINEL;
      }
      if (typeof value === "string") {
        return value.trim();
      }
      return value;
    },
    z.string({ error: invalidMessage }).superRefine((value, ctx) => {
      if (value === JS_NUMBER_SENTINEL) {
        ctx.addIssue({ code: "custom", message: PAYMENT_JS_NUMBER_FORBIDDEN });
        return;
      }
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        ctx.addIssue({ code: "custom", message: invalidMessage });
      }
    }),
  );

const optionalMoneyDecimalStringSchema = z.preprocess(
  (value) => {
    if (typeof value === "number") {
      return JS_NUMBER_SENTINEL;
    }
    return blankToNull(value);
  },
  z
    .string()
    .nullable()
    .superRefine((value, ctx) => {
      if (value === null) {
        return;
      }
      if (value === JS_NUMBER_SENTINEL) {
        ctx.addIssue({ code: "custom", message: PAYMENT_JS_NUMBER_FORBIDDEN });
        return;
      }
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        ctx.addIssue({ code: "custom", message: PAYMENT_INVALID_INPUT });
      }
    }),
);

const paymentDateSchema = z.preprocess(
  (value) => {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return new Date(`${trimmed}T00:00:00.000Z`);
      }
      return new Date(trimmed);
    }
    return value;
  },
  z.date({ error: "Payment date is required" }),
);

const receivedAtSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string") {
    return new Date(value);
  }
  return value;
}, z.date().nullable());

/**
 * Persistence write shape for a payment record (TASK-044).
 * Does not charge gateways, allocate to invoices, or resolve open ADRs.
 * Converted settlement must already exclude processor fee (enforced by invariants / TASK-019 helpers).
 */
export const paymentWriteSchema = z.strictObject({
  companyId: z.uuid({ error: PAYMENT_COMPANY_REQUIRED }),
  invoiceId: z.uuid({ error: PAYMENT_INVOICE_REQUIRED }),
  customerId: z.uuid({ error: PAYMENT_CUSTOMER_REQUIRED }),
  methodCode: paymentMethodCodeSchema,
  externalTransactionId: nullableText(200),
  status: paymentStatusSchema.optional().default("PENDING"),
  invoiceCurrencyCode: currencyCodeSchema,
  invoiceAmountApplied: moneyDecimalStringSchema(PAYMENT_AMOUNT_REQUIRED),
  settlementCurrencyCode: currencyCodeSchema,
  fixedConversionRate: moneyDecimalStringSchema(PAYMENT_INVALID_INPUT),
  rateVersionId: nullableUuid,
  rateSource: paymentRateSourceSchema,
  convertedSettlementAmount: moneyDecimalStringSchema(PAYMENT_INVALID_INPUT),
  processorFeeAmount: optionalMoneyDecimalStringSchema,
  actualReceivedAmount: optionalMoneyDecimalStringSchema,
  paymentDate: paymentDateSchema,
  receivedAt: receivedAtSchema.optional().default(null),
  source: paymentSourceSchema,
  notes: nullableText(5000),
  createdByUserId: nullableUuid.optional().default(null),
  confirmedByUserId: nullableUuid.optional().default(null),
});

export type PaymentWriteInput = z.output<typeof paymentWriteSchema>;
export type PaymentWriteFormValues = z.input<typeof paymentWriteSchema>;
