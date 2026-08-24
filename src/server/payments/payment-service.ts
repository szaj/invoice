import "server-only";

import { logger } from "@/lib/logger";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError, GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { CURRENCY_DISABLED_FOR_NEW_SELECTION } from "@/domain/currencies/types";
import { FIXED_RATE_MISSING_FOR_CONVERSION } from "@/domain/fixed-rates/types";
import { isCollectibleInvoiceStatus } from "@/domain/invoices/cancellation";
import { INVOICE_NOT_FOUND, type InvoiceRecord } from "@/domain/invoices/types";
import {
  computeConvertedSettlementAmount,
  moneyDecimal,
  roundMoney,
  toDecimalString,
} from "@/domain/money";
import { canViewPayment } from "@/domain/payments/access";
import {
  assertConfirmedFinancialFieldsUnchanged,
  assertProcessorFeeExcludedFromSettlement,
} from "@/domain/payments/invariants";
import {
  paymentCreatePendingSchema,
  paymentIdSchema,
  paymentListQuerySchema,
  paymentWriteSchema,
} from "@/domain/payments/schema";
import {
  confirmSnapshotLock,
  isConversionSnapshotComplete,
  isCrossCurrencyPayment,
  snapshotRateEffectiveAt,
} from "@/domain/payments/snapshot";
import { assertPaymentStatusTransition } from "@/domain/payments/transitions";
import {
  PAYMENT_AMOUNT_NOT_POSITIVE,
  PAYMENT_COMPANY_SCOPE_REQUIRED,
  PAYMENT_CONFIRMED_IMMUTABLE,
  PAYMENT_FEE_MUST_NOT_AFFECT_SETTLEMENT,
  PAYMENT_ILLEGAL_TRANSITION,
  PAYMENT_INVALID_INPUT,
  PAYMENT_INVOICE_NOT_PAYABLE,
  PAYMENT_NOT_FOUND,
  PAYMENT_RECORD_FORBIDDEN,
  PAYMENT_UNAVAILABLE,
  type PaymentRateSource,
  type PaymentRecord,
} from "@/domain/payments/types";
import { assertSettlementCurrencyEnabled } from "@/domain/settlement/assert-enabled";
import { SETTLEMENT_CURRENCY_NOT_ENABLED } from "@/domain/settlement/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaCurrencyStore } from "@/server/currencies/currency-repository";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import {
  resolveFixedConversionRate,
  type ResolveRateDependencies,
} from "@/server/fixed-rates/resolve-rate-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

export type PaymentServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface PaymentServiceDependencies {
  readonly payments: Pick<
    PrismaPaymentStore,
    "getPaymentById" | "listPayments" | "createPayment" | "updatePaymentLifecycle"
  >;
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById" | "listInvoices">;
  readonly customers: Pick<PrismaCustomerStore, "getCustomerById">;
  readonly settlement: Pick<PrismaSettlementConfigStore, "getCompanySettlementConfiguration">;
  readonly currencies: Pick<PrismaCurrencyStore, "findByCode">;
  readonly resolveRate?: (
    fromCurrency: string,
    toCurrency: string,
    at: Date,
  ) => ReturnType<typeof resolveFixedConversionRate>;
  readonly resolveRateDeps?: ResolveRateDependencies;
  readonly auditWriter?: AuditWriter;
  readonly now?: () => Date;
}

export function createDefaultPaymentServiceDependencies(): PaymentServiceDependencies {
  return {
    payments: new PrismaPaymentStore(),
    invoices: new PrismaInvoiceStore(),
    customers: new PrismaCustomerStore(),
    settlement: new PrismaSettlementConfigStore(),
    currencies: new PrismaCurrencyStore(),
  };
}

function auditWriterOf(deps: PaymentServiceDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function nowOf(deps: PaymentServiceDependencies): Date {
  return deps.now?.() ?? new Date();
}

function accessibleCompanyIds(actor: AuthorizationPrincipal): string[] | "ALL" {
  const scope = companyScopeForRole(actor.roleCode);
  if (scope === "ALL") {
    return "ALL";
  }
  return [...assignedCompanyIdsOf(actor)];
}

function mapRateSource(source: "same_currency" | "admin_fixed_rate"): PaymentRateSource {
  return source === "same_currency" ? "SAME_CURRENCY" : "ADMIN_FIXED_RATE";
}

function paymentAuditSnapshot(payment: PaymentRecord) {
  return {
    id: payment.id,
    companyId: payment.companyId,
    invoiceId: payment.invoiceId,
    customerId: payment.customerId,
    methodCode: payment.methodCode,
    status: payment.status,
    invoiceCurrencyCode: payment.invoiceCurrencyCode,
    invoiceAmountApplied: payment.invoiceAmountApplied,
    settlementCurrencyCode: payment.settlementCurrencyCode,
    fixedConversionRate: payment.fixedConversionRate,
    rateSource: payment.rateSource,
    rateVersionId: payment.rateVersionId,
    rateEffectiveAt: payment.rateEffectiveAt?.toISOString() ?? null,
    convertedSettlementAmount: payment.convertedSettlementAmount,
    processorFeeAmount: payment.processorFeeAmount,
    actualReceivedAmount: payment.actualReceivedAmount,
    paymentDate: payment.paymentDate.toISOString().slice(0, 10),
    source: payment.source,
    externalTransactionId: payment.externalTransactionId,
  };
}

async function resolveRateOf(
  deps: PaymentServiceDependencies,
  fromCurrency: string,
  toCurrency: string,
  at: Date,
) {
  if (deps.resolveRate) {
    return deps.resolveRate(fromCurrency, toCurrency, at);
  }
  return resolveFixedConversionRate(fromCurrency, toCurrency, at, deps.resolveRateDeps);
}

async function loadVisibleInvoiceForPayment(
  actor: AuthorizationPrincipal,
  payment: PaymentRecord,
  deps: PaymentServiceDependencies,
): Promise<PaymentServiceResult<InvoiceRecord>> {
  assertCompanyAccess(actor, payment.companyId);
  const invoice = await deps.invoices.getInvoiceById(payment.invoiceId);
  if (!invoice || !canViewPayment(actor, payment, invoice)) {
    return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
  }
  return { ok: true, data: invoice };
}

/**
 * GET payments (TASK-045). View follows company assignment + invoice visibility.
 * Does not require payment.manual.record (Staff optional grant remains denied).
 */
export async function listPayments(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<PaymentRecord[]>> {
  try {
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }
    if (actor.status !== "ACTIVE" || !actor.roleCode) {
      throw new AuthorizationError(actor.status !== "ACTIVE" ? "suspended" : "missing_role");
    }

    const parsed = paymentListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }

    const accessible = accessibleCompanyIds(actor);
    let companyIds: string[];
    if (parsed.data.companyId) {
      assertCompanyAccess(actor, parsed.data.companyId);
      companyIds = [parsed.data.companyId];
    } else if (accessible === "ALL") {
      return { ok: false, status: 400, error: PAYMENT_COMPANY_SCOPE_REQUIRED };
    } else {
      companyIds = accessible;
    }

    const [rows, invoices] = await Promise.all([
      deps.payments.listPayments({
        companyIds,
        invoiceId: parsed.data.invoiceId,
        customerId: parsed.data.customerId,
        status: parsed.data.status,
      }),
      deps.invoices.listInvoices({ companyIds }),
    ]);

    const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    const visible = rows.filter((payment) => {
      const invoice = invoicesById.get(payment.invoiceId);
      return invoice ? canViewPayment(actor, payment, invoice) : false;
    });

    return { ok: true, data: visible };
  } catch (error) {
    return toPaymentError(error, "read");
  }
}

export async function getPayment(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<PaymentRecord>> {
  try {
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = paymentIdSchema.safeParse(paymentId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const payment = await deps.payments.getPaymentById(parsedId.data);
    if (!payment) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const invoiceResult = await loadVisibleInvoiceForPayment(actor, payment, deps);
    if (!invoiceResult.ok) {
      return invoiceResult;
    }

    return { ok: true, data: payment };
  } catch (error) {
    return toPaymentError(error, "read");
  }
}

/**
 * Create a PENDING payment (TASK-045).
 * authorization → company scope → invoice/customer → currency/settlement → conversion → persist → audit.
 * Stores the Admin fixed-rate snapshot including rateEffectiveAt (TASK-046). Does not charge gateways,
 * allocate, or mutate invoice outstanding (later tasks).
 */
export async function createPendingPayment(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<PaymentRecord>> {
  try {
    assertPermission(actor, "payment.manual.record");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = paymentCreatePendingSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }

    const invoice = await deps.invoices.getInvoiceById(parsed.data.invoiceId);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    assertCompanyAccess(actor, invoice.companyId);
    if (!canViewPayment(actor, { companyId: invoice.companyId }, invoice)) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    if (!isCollectibleInvoiceStatus(invoice.status)) {
      return { ok: false, status: 400, error: PAYMENT_INVOICE_NOT_PAYABLE };
    }

    const customer = await deps.customers.getCustomerById(invoice.customerId);
    if (!customer || !customer.companyIds.includes(invoice.companyId)) {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }

    const settlementConfig = await deps.settlement.getCompanySettlementConfiguration(
      invoice.companyId,
    );
    if (!settlementConfig) {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }
    const method = settlementConfig.methods.find(
      (row) => row.methodCode === parsed.data.methodCode,
    );
    const settlementCheck = assertSettlementCurrencyEnabled(
      method,
      parsed.data.settlementCurrencyCode,
    );
    if (!settlementCheck.ok) {
      return { ok: false, status: 400, error: SETTLEMENT_CURRENCY_NOT_ENABLED };
    }

    const settlementCurrency = await deps.currencies.findByCode(parsed.data.settlementCurrencyCode);
    if (!settlementCurrency) {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }
    if (settlementCurrency.status !== "ACTIVE") {
      return { ok: false, status: 400, error: CURRENCY_DISABLED_FOR_NEW_SELECTION };
    }

    const invoiceCurrency = await deps.currencies.findByCode(invoice.currencyCode);
    const invoicePrecision = invoiceCurrency?.decimalPrecision ?? 2;

    let applied;
    try {
      applied = moneyDecimal(parsed.data.invoiceAmountApplied);
    } catch {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }
    if (!applied.gt(0)) {
      return { ok: false, status: 400, error: PAYMENT_AMOUNT_NOT_POSITIVE };
    }
    const invoiceAmountApplied = toDecimalString(roundMoney(applied, invoicePrecision));

    if (parsed.data.processorFeeAmount != null) {
      try {
        if (moneyDecimal(parsed.data.processorFeeAmount).lt(0)) {
          return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
        }
      } catch {
        return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
      }
    }

    const rateResult = await resolveRateOf(
      deps,
      invoice.currencyCode,
      settlementCurrency.code,
      parsed.data.paymentDate,
    );
    if (!rateResult.ok) {
      return { ok: false, status: 400, error: FIXED_RATE_MISSING_FOR_CONVERSION };
    }

    const converted = computeConvertedSettlementAmount({
      invoiceAmountApplied,
      invoiceCurrencyCode: invoice.currencyCode,
      settlementCurrencyCode: settlementCurrency.code,
      fixedConversionRate: rateResult.fixedRate,
      settlementDecimalPrecision: settlementCurrency.decimalPrecision,
      processorFee: parsed.data.processorFeeAmount,
    });

    const rateSource = mapRateSource(converted.rateSource);
    const writeParsed = paymentWriteSchema.safeParse({
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      methodCode: parsed.data.methodCode,
      externalTransactionId: parsed.data.externalTransactionId,
      status: "PENDING",
      invoiceCurrencyCode: invoice.currencyCode,
      invoiceAmountApplied,
      settlementCurrencyCode: settlementCurrency.code,
      fixedConversionRate: converted.fixedConversionRateApplied,
      rateVersionId: rateResult.rateVersionId,
      rateSource,
      rateEffectiveAt: snapshotRateEffectiveAt({
        rateSource,
        paymentDate: parsed.data.paymentDate,
        rateValidFrom: rateResult.validFrom,
      }),
      convertedSettlementAmount: converted.convertedSettlementAmount.amount,
      processorFeeAmount:
        parsed.data.processorFeeAmount != null
          ? toDecimalString(parsed.data.processorFeeAmount)
          : null,
      actualReceivedAmount:
        parsed.data.actualReceivedAmount != null
          ? toDecimalString(parsed.data.actualReceivedAmount)
          : null,
      paymentDate: parsed.data.paymentDate,
      receivedAt: null,
      source: parsed.data.source,
      notes: parsed.data.notes,
      createdByUserId: actor.userId,
      confirmedByUserId: null,
    });
    if (!writeParsed.success) {
      return { ok: false, status: 400, error: PAYMENT_INVALID_INPUT };
    }

    assertProcessorFeeExcludedFromSettlement(writeParsed.data, settlementCurrency.decimalPrecision);

    const created = await deps.payments.createPayment(writeParsed.data);

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: created.companyId,
        entityType: AuditEntityTypes.PAYMENT,
        entityId: created.id,
        action: AuditActions.PAYMENT_CREATED,
        newValues: paymentAuditSnapshot(created),
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.created",
        actorUserId: actor.userId,
        paymentId: created.id,
        invoiceId: created.invoiceId,
        companyId: created.companyId,
        status: created.status,
      },
      "Pending payment created",
    );

    return { ok: true, data: created };
  } catch (error) {
    return toPaymentError(error, "write");
  }
}

export async function confirmPayment(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<PaymentRecord>> {
  try {
    assertPermission(actor, "payment.manual.record");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = paymentIdSchema.safeParse(paymentId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const payment = await deps.payments.getPaymentById(parsedId.data);
    if (!payment) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const invoiceResult = await loadVisibleInvoiceForPayment(actor, payment, deps);
    if (!invoiceResult.ok) {
      return invoiceResult;
    }

    assertPaymentStatusTransition(payment.status, "SUCCESSFUL");
    assertConfirmedFinancialFieldsUnchanged(payment, {});

    let snapshotPatch: {
      readonly rateEffectiveAt?: Date;
      readonly rateVersionId?: string | null;
    } = {};

    if (!isConversionSnapshotComplete(payment)) {
      if (isCrossCurrencyPayment(payment)) {
        const rateResult = await resolveRateOf(
          deps,
          payment.invoiceCurrencyCode,
          payment.settlementCurrencyCode,
          payment.paymentDate,
        );
        if (!rateResult.ok) {
          return { ok: false, status: 400, error: FIXED_RATE_MISSING_FOR_CONVERSION };
        }
        snapshotPatch = confirmSnapshotLock(payment, {
          rateEffectiveAt: snapshotRateEffectiveAt({
            rateSource: "ADMIN_FIXED_RATE",
            paymentDate: payment.paymentDate,
            rateValidFrom: rateResult.validFrom,
          }),
          rateVersionId: rateResult.rateVersionId,
        });
      } else {
        snapshotPatch = {
          rateEffectiveAt: payment.rateEffectiveAt ?? payment.paymentDate,
          rateVersionId: payment.rateVersionId,
        };
      }
    }

    const receivedAt = nowOf(deps);
    const updated = await deps.payments.updatePaymentLifecycle(payment.id, payment.status, {
      status: "SUCCESSFUL",
      receivedAt,
      confirmedByUserId: actor.userId,
      ...snapshotPatch,
    });
    if (!updated) {
      return { ok: false, status: 400, error: PAYMENT_ILLEGAL_TRANSITION };
    }

    const settlementCurrency = await deps.currencies.findByCode(updated.settlementCurrencyCode);
    assertProcessorFeeExcludedFromSettlement(updated, settlementCurrency?.decimalPrecision ?? 2);

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: updated.companyId,
        entityType: AuditEntityTypes.PAYMENT,
        entityId: updated.id,
        action: AuditActions.PAYMENT_CONFIRMED,
        oldValues: { status: payment.status },
        newValues: {
          status: updated.status,
          receivedAt: updated.receivedAt?.toISOString() ?? null,
          confirmedByUserId: updated.confirmedByUserId,
          invoiceAmountApplied: updated.invoiceAmountApplied,
          invoiceCurrencyCode: updated.invoiceCurrencyCode,
          settlementCurrencyCode: updated.settlementCurrencyCode,
          fixedConversionRate: updated.fixedConversionRate,
          rateSource: updated.rateSource,
          rateVersionId: updated.rateVersionId,
          rateEffectiveAt: updated.rateEffectiveAt?.toISOString() ?? null,
          convertedSettlementAmount: updated.convertedSettlementAmount,
          processorFeeAmount: updated.processorFeeAmount,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.confirmed",
        actorUserId: actor.userId,
        paymentId: updated.id,
        invoiceId: updated.invoiceId,
        companyId: updated.companyId,
      },
      "Payment confirmed",
    );

    return { ok: true, data: updated };
  } catch (error) {
    return toPaymentError(error, "write");
  }
}

export async function failPayment(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  deps: PaymentServiceDependencies = createDefaultPaymentServiceDependencies(),
): Promise<PaymentServiceResult<PaymentRecord>> {
  try {
    assertPermission(actor, "payment.manual.record");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = paymentIdSchema.safeParse(paymentId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const payment = await deps.payments.getPaymentById(parsedId.data);
    if (!payment) {
      return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
    }

    const invoiceResult = await loadVisibleInvoiceForPayment(actor, payment, deps);
    if (!invoiceResult.ok) {
      return invoiceResult;
    }

    assertPaymentStatusTransition(payment.status, "FAILED");

    const updated = await deps.payments.updatePaymentLifecycle(payment.id, payment.status, {
      status: "FAILED",
    });
    if (!updated) {
      return { ok: false, status: 400, error: PAYMENT_ILLEGAL_TRANSITION };
    }

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: updated.companyId,
        entityType: AuditEntityTypes.PAYMENT,
        entityId: updated.id,
        action: AuditActions.PAYMENT_FAILED,
        oldValues: { status: payment.status },
        newValues: { status: updated.status },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.failed",
        actorUserId: actor.userId,
        paymentId: updated.id,
        invoiceId: updated.invoiceId,
        companyId: updated.companyId,
      },
      "Payment marked failed",
    );

    return { ok: true, data: updated };
  } catch (error) {
    return toPaymentError(error, "write");
  }
}

function toPaymentError(
  error: unknown,
  kind: "read" | "write" = "write",
): {
  ok: false;
  status: 400 | 403 | 404 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      status: 403,
      error: kind === "write" ? PAYMENT_RECORD_FORBIDDEN : GENERIC_FORBIDDEN,
    };
  }
  if (error instanceof Error) {
    if (
      error.message === PAYMENT_ILLEGAL_TRANSITION ||
      error.message === PAYMENT_CONFIRMED_IMMUTABLE ||
      error.message === PAYMENT_INVOICE_NOT_PAYABLE ||
      error.message === PAYMENT_FEE_MUST_NOT_AFFECT_SETTLEMENT ||
      error.message === FIXED_RATE_MISSING_FOR_CONVERSION
    ) {
      return { ok: false, status: 400, error: error.message };
    }
  }

  logger.error(
    {
      event: "payments.unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Payment operation failed",
  );
  return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
}
