import { z } from "zod";

import {
  LIST_SORT_DIRS,
  PAYMENT_LIST_DEFAULT_SORT_BY,
  PAYMENT_LIST_DEFAULT_SORT_DIR,
  PAYMENT_LIST_SORT_FIELDS,
  firstSearchParam,
  resolveListPagination,
  type ListSortDir,
  type PaymentListSortField,
} from "@/domain/lists/pagination";
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
  rateEffectiveAt: receivedAtSchema.optional().default(null),
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

/**
 * Application create-pending input (TASK-045 / TASK-047).
 * Company/customer/rate/converted settlement are derived server-side — never trusted from the client.
 * Optional fee and actual received are reconciliation-only; actual received is never derived from fee.
 */
export const paymentCreatePendingSchema = z.strictObject({
  invoiceId: z.uuid({ error: PAYMENT_INVOICE_REQUIRED }),
  methodCode: paymentMethodCodeSchema,
  invoiceAmountApplied: moneyDecimalStringSchema(PAYMENT_AMOUNT_REQUIRED),
  settlementCurrencyCode: currencyCodeSchema,
  paymentDate: paymentDateSchema,
  externalTransactionId: nullableText(200).optional().default(null),
  source: paymentSourceSchema.optional().default("MANUAL"),
  notes: nullableText(5000).optional().default(null),
  processorFeeAmount: optionalMoneyDecimalStringSchema.optional().default(null),
  actualReceivedAmount: optionalMoneyDecimalStringSchema.optional().default(null),
});

export type PaymentCreatePendingInput = z.output<typeof paymentCreatePendingSchema>;
export type PaymentCreatePendingFormValues = z.input<typeof paymentCreatePendingSchema>;

/**
 * Manual payment recording input (TASK-050 / Payments §10.6).
 * Method and source are always MANUAL. Company/customer/rate/settlement math are server-derived.
 * `externalTransactionId` is an optional human reference — never a fabricated gateway transaction id.
 */
export const paymentManualRecordSchema = z.strictObject({
  invoiceId: z.uuid({ error: PAYMENT_INVOICE_REQUIRED }),
  invoiceAmountApplied: moneyDecimalStringSchema(PAYMENT_AMOUNT_REQUIRED),
  settlementCurrencyCode: currencyCodeSchema,
  paymentDate: paymentDateSchema,
  externalTransactionId: nullableText(200).optional().default(null),
  notes: nullableText(5000).optional().default(null),
  processorFeeAmount: optionalMoneyDecimalStringSchema.optional().default(null),
  actualReceivedAmount: optionalMoneyDecimalStringSchema.optional().default(null),
});

export type PaymentManualRecordInput = z.output<typeof paymentManualRecordSchema>;
export type PaymentManualRecordFormValues = z.input<typeof paymentManualRecordSchema>;

/**
 * Hosted checkout create input (TASK-058).
 * Amount defaults server-side to open balance from SUCCESSFUL applications when omitted.
 * Company/customer/rate/converted settlement are never trusted from the client.
 */
export const paymentHostedCheckoutSchema = z.strictObject({
  invoiceId: z.uuid({ error: PAYMENT_INVOICE_REQUIRED }),
  methodCode: paymentMethodCodeSchema,
  settlementCurrencyCode: currencyCodeSchema,
  /** Optional override; when omitted the service uses open invoice balance (BR-010). */
  invoiceAmountApplied: moneyDecimalStringSchema(PAYMENT_AMOUNT_REQUIRED).optional(),
});

export type PaymentHostedCheckoutInput = z.output<typeof paymentHostedCheckoutSchema>;
export type PaymentHostedCheckoutFormValues = z.input<typeof paymentHostedCheckoutSchema>;

const optionalPositiveInt = (min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number.parseInt(value.trim(), 10);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
  }, z.number().int().min(min).max(max).optional());

export const paymentListQuerySchema = z.strictObject({
  companyId: z.uuid().optional(),
  invoiceId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  status: paymentStatusSchema.optional(),
  page: optionalPositiveInt(1, 10_000),
  pageSize: optionalPositiveInt(1, 10_000),
  sortBy: z.enum(PAYMENT_LIST_SORT_FIELDS).optional(),
  sortDir: z.enum(LIST_SORT_DIRS).optional(),
});

export type PaymentListQuery = z.output<typeof paymentListQuerySchema>;

export type ResolvedPaymentListQuery = {
  readonly companyId?: string;
  readonly invoiceId?: string;
  readonly customerId?: string;
  readonly status?: PaymentListQuery["status"];
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: PaymentListSortField;
  readonly sortDir: ListSortDir;
};

export function resolvePaymentListQuery(query: PaymentListQuery): ResolvedPaymentListQuery {
  const pagination = resolveListPagination({ page: query.page, pageSize: query.pageSize });
  return {
    companyId: query.companyId,
    invoiceId: query.invoiceId,
    customerId: query.customerId,
    status: query.status,
    page: pagination.page,
    pageSize: pagination.pageSize,
    sortBy: query.sortBy ?? PAYMENT_LIST_DEFAULT_SORT_BY,
    sortDir: query.sortDir ?? PAYMENT_LIST_DEFAULT_SORT_DIR,
  };
}

/**
 * Parse payments list page searchParams into list query input.
 * Keeps filter/query logic out of React components (TASK-061 / TASK-098).
 */
export function parsePaymentListSearchParams(
  params: Record<string, string | string[] | undefined>,
): PaymentListQuery {
  const parsed = paymentListQuerySchema.safeParse({
    companyId: firstSearchParam(params.companyId),
    status: firstSearchParam(params.status),
    invoiceId: firstSearchParam(params.invoiceId),
    customerId: firstSearchParam(params.customerId),
    page: firstSearchParam(params.page),
    pageSize: firstSearchParam(params.pageSize),
    sortBy: firstSearchParam(params.sortBy),
    sortDir: firstSearchParam(params.sortDir),
  });
  return parsed.success ? parsed.data : {};
}
