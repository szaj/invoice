import "server-only";

import { logger } from "@/lib/logger";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import type { InvoiceRecord } from "@/domain/invoices/types";
import { canViewPayment } from "@/domain/payments/access";
import {
  paymentRefundLifecycle,
  type PaymentAdjustmentRecord,
  type PaymentRefundLifecycle,
} from "@/domain/payments/adjustments";
import { assertConfirmedFinancialFieldsUnchanged } from "@/domain/payments/invariants";
import { providerSupports } from "@/domain/payments/providers/capabilities";
import type { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import type { PaymentProvider, RefundPaymentResult } from "@/domain/payments/providers/types";
import { paymentIdSchema } from "@/domain/payments/schema";
import {
  PAYMENT_CONFIRMED_IMMUTABLE,
  PAYMENT_NOT_FOUND,
  PAYMENT_UNAVAILABLE,
  type PaymentRecord,
} from "@/domain/payments/types";
import {
  assertPaymentCanProcessFullRefund,
  assertPaymentCanProcessPartialRefund,
  assertProcessedRefundAdjustment,
  resolveFullRefundAmounts,
  resolvePartialRefundAmounts,
} from "@/domain/refunds/invariants";
import { fullRefundSchema, partialRefundSchema } from "@/domain/refunds/schema";
import {
  PAYMENT_ADJUST_FORBIDDEN,
  REFUND_ALREADY_PROCESSED,
  REFUND_AMOUNT_INVALID,
  REFUND_EXCEEDS_PAYMENT,
  REFUND_INVALID_INPUT,
  REFUND_PROVIDER_FAILED,
  REFUND_REQUIRES_SUCCESSFUL_PAYMENT,
  REFUND_SETTLEMENT_AMOUNT_INVALID,
} from "@/domain/refunds/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { assertTransactionalCompanyRequest } from "@/server/company-context/transactional";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import {
  PrismaPaymentAdjustmentStore,
  type PaymentAdjustmentCreateInput,
} from "@/server/payments/payment-adjustment-repository";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { createPaymentProviderRegistry } from "@/server/payments/providers/create-payment-provider-registry";

export type RefundServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 404 | 503; error: string };

export type ProcessFullRefundResult = {
  readonly payment: PaymentRecord;
  readonly adjustment: PaymentAdjustmentRecord;
  readonly lifecycle: PaymentRefundLifecycle;
  readonly providerRefund: RefundPaymentResult | null;
};

export type ProcessPartialRefundResult = ProcessFullRefundResult;

export interface RefundServiceDependencies {
  readonly payments: Pick<PrismaPaymentStore, "getPaymentById">;
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById">;
  readonly adjustments: Pick<
    PrismaPaymentAdjustmentStore,
    "createAdjustment" | "listAdjustmentsByPayment"
  >;
  readonly providerRegistry?: PaymentProviderRegistry;
  readonly auditWriter?: AuditWriter;
  readonly now?: () => Date;
  readonly enforceTransactionalCompanyScope?: (
    actor: AuthorizationPrincipal,
    companyId: string,
  ) => Promise<RefundServiceResult<true>>;
}

export function createDefaultRefundServiceDependencies(): RefundServiceDependencies {
  return {
    payments: new PrismaPaymentStore(),
    invoices: new PrismaInvoiceStore(),
    adjustments: new PrismaPaymentAdjustmentStore(),
  };
}

function auditWriterOf(deps: RefundServiceDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function nowOf(deps: RefundServiceDependencies): Date {
  return deps.now?.() ?? new Date();
}

function registryOf(deps: RefundServiceDependencies): PaymentProviderRegistry {
  return deps.providerRegistry ?? createPaymentProviderRegistry();
}

function paymentFinancialSnapshot(payment: PaymentRecord) {
  return {
    status: payment.status,
    invoiceCurrencyCode: payment.invoiceCurrencyCode,
    invoiceAmountApplied: payment.invoiceAmountApplied,
    settlementCurrencyCode: payment.settlementCurrencyCode,
    fixedConversionRate: payment.fixedConversionRate,
    rateVersionId: payment.rateVersionId,
    rateSource: payment.rateSource,
    rateEffectiveAt: payment.rateEffectiveAt?.toISOString() ?? null,
    convertedSettlementAmount: payment.convertedSettlementAmount,
    processorFeeAmount: payment.processorFeeAmount,
    actualReceivedAmount: payment.actualReceivedAmount,
    paymentDate: payment.paymentDate.toISOString().slice(0, 10),
    methodCode: payment.methodCode,
    externalTransactionId: payment.externalTransactionId,
  };
}

async function enforceTransactionalCompanyScopeOf(
  actor: AuthorizationPrincipal,
  companyId: string,
  deps: RefundServiceDependencies,
): Promise<RefundServiceResult<true>> {
  if (deps.enforceTransactionalCompanyScope) {
    return deps.enforceTransactionalCompanyScope(actor, companyId);
  }
  const scope = await assertTransactionalCompanyRequest(actor, companyId);
  if (!scope.ok) {
    return { ok: false, status: scope.status, error: scope.error };
  }
  return { ok: true, data: true };
}

async function loadVisiblePayment(
  actor: AuthorizationPrincipal,
  paymentId: string,
  deps: RefundServiceDependencies,
): Promise<RefundServiceResult<{ payment: PaymentRecord; invoice: InvoiceRecord }>> {
  const parsedId = paymentIdSchema.safeParse(paymentId);
  if (!parsedId.success) {
    return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
  }

  const payment = await deps.payments.getPaymentById(parsedId.data);
  if (!payment) {
    return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
  }

  assertCompanyAccess(actor, payment.companyId);
  const invoice = await deps.invoices.getInvoiceById(payment.invoiceId);
  if (!invoice || !canViewPayment(actor, payment, invoice)) {
    return { ok: false, status: 404, error: PAYMENT_NOT_FOUND };
  }

  return { ok: true, data: { payment, invoice } };
}

/**
 * Optionally call adapter.refundPayment when the method supports refunds and has an
 * external transaction id. Manual / unsupported adapters skip provider call (TASK-064/065).
 * Partial refunds require supportsPartialRefunds; full refunds require supportsRefunds.
 */
async function maybeRefundViaProvider(
  payment: PaymentRecord,
  settlementAmount: string,
  deps: RefundServiceDependencies,
  options: { readonly partial: boolean } = { partial: false },
): Promise<RefundPaymentResult | null> {
  if (!payment.externalTransactionId) {
    return null;
  }

  let provider: PaymentProvider;
  try {
    provider = registryOf(deps).require(payment.methodCode);
  } catch {
    return null;
  }

  const capability = options.partial ? "supportsPartialRefunds" : "supportsRefunds";
  if (!providerSupports(provider, capability)) {
    return null;
  }

  try {
    return await provider.refundPayment({
      companyId: payment.companyId,
      externalTransactionId: payment.externalTransactionId,
      amount: settlementAmount,
      settlementCurrencyCode: payment.settlementCurrencyCode,
      partial: options.partial,
    });
  } catch (error) {
    logger.error(
      {
        event: "payments.refund_provider_failed",
        paymentId: payment.id,
        methodCode: payment.methodCode,
        partial: options.partial,
        err: error instanceof Error ? error.message : "unknown",
      },
      "Provider refund failed",
    );
    throw new Error(REFUND_PROVIDER_FAILED);
  }
}

/**
 * Record a processed full refund as a linked adjustment (TASK-064).
 * Original SUCCESSFUL payment is never rewritten (BR-023). Settlement uses merchant
 * actual amount when provided, else the payment fixed-rate snapshot (BR-025).
 * Requires payment.adjust. Optionally calls adapter.refundPayment when supported.
 */
export async function processFullRefund(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  input: unknown = {},
  deps: RefundServiceDependencies = createDefaultRefundServiceDependencies(),
): Promise<RefundServiceResult<ProcessFullRefundResult>> {
  try {
    assertPermission(actor, "payment.adjust");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = fullRefundSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: REFUND_INVALID_INPUT };
    }

    const loaded = await loadVisiblePayment(actor, paymentId, deps);
    if (!loaded.ok) {
      return loaded;
    }

    const { payment } = loaded.data;
    const existing = await deps.adjustments.listAdjustmentsByPayment(payment.id);
    assertPaymentCanProcessFullRefund(payment, existing);
    assertConfirmedFinancialFieldsUnchanged(payment, {});

    const amounts = resolveFullRefundAmounts({
      payment,
      actualSettlementAmount: parsed.data.actualSettlementAmount,
    });

    const scope = await enforceTransactionalCompanyScopeOf(actor, payment.companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    const providerRefund = await maybeRefundViaProvider(payment, amounts.settlementAmount, deps);

    const now = nowOf(deps);
    const effectiveDate = parsed.data.effectiveDate ?? now;
    const createInput: PaymentAdjustmentCreateInput = {
      companyId: payment.companyId,
      paymentId: payment.id,
      type: "REFUND",
      status: "PROCESSED",
      amount: amounts.amount,
      invoiceAmount: amounts.invoiceAmount,
      settlementAmount: amounts.settlementAmount,
      reason: parsed.data.reason ?? null,
      merchantReference: parsed.data.merchantReference ?? null,
      notes: parsed.data.notes ?? null,
      effectiveDate,
      openedAt: null,
      processedAt: now,
      resolvedAt: now,
      createdByUserId: actor.userId,
    };

    const adjustment = await deps.adjustments.createAdjustment(createInput);
    assertProcessedRefundAdjustment(adjustment);
    assertConfirmedFinancialFieldsUnchanged(payment, {
      invoiceAmountApplied: payment.invoiceAmountApplied,
      convertedSettlementAmount: payment.convertedSettlementAmount,
      fixedConversionRate: payment.fixedConversionRate,
      processorFeeAmount: payment.processorFeeAmount,
      actualReceivedAmount: payment.actualReceivedAmount,
      invoiceCurrencyCode: payment.invoiceCurrencyCode,
      settlementCurrencyCode: payment.settlementCurrencyCode,
    });

    const listed = await deps.adjustments.listAdjustmentsByPayment(payment.id);
    const lifecycle = paymentRefundLifecycle(listed);
    if (lifecycle == null) {
      return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
    }

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: payment.companyId,
        entityType: AuditEntityTypes.PAYMENT_ADJUSTMENT,
        entityId: adjustment.id,
        action: AuditActions.PAYMENT_REFUND_PROCESSED,
        oldValues: paymentFinancialSnapshot(payment),
        newValues: {
          paymentId: payment.id,
          paymentStatus: payment.status,
          adjustmentId: adjustment.id,
          type: adjustment.type,
          status: adjustment.status,
          amount: adjustment.amount,
          invoiceAmount: adjustment.invoiceAmount,
          settlementAmount: adjustment.settlementAmount,
          reason: adjustment.reason,
          merchantReference: adjustment.merchantReference,
          lifecycle,
          providerRefundId: providerRefund?.externalRefundId ?? null,
          usedMerchantActualSettlement: parsed.data.actualSettlementAmount != null,
        },
        reason: adjustment.reason,
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.refund_processed",
        actorUserId: actor.userId,
        paymentId: payment.id,
        adjustmentId: adjustment.id,
        companyId: payment.companyId,
        settlementAmount: adjustment.settlementAmount,
        providerRefundId: providerRefund?.externalRefundId ?? null,
      },
      "Full refund processed as linked adjustment",
    );

    return { ok: true, data: { payment, adjustment, lifecycle, providerRefund } };
  } catch (error) {
    return toRefundError(error, "full");
  }
}

/**
 * Record a processed partial refund as a linked adjustment (TASK-065).
 * Cumulative invoice + settlement deductions cannot exceed the original payment
 * (over-refund rejected by default). Original SUCCESSFUL payment is never rewritten (BR-023).
 * Settlement uses merchant actual when provided, else invoiceAmount × fixed-rate snapshot (BR-025).
 * Requires payment.adjust. Optionally calls adapter.refundPayment when supportsPartialRefunds.
 */
export async function processPartialRefund(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  input: unknown = {},
  deps: RefundServiceDependencies = createDefaultRefundServiceDependencies(),
): Promise<RefundServiceResult<ProcessPartialRefundResult>> {
  try {
    assertPermission(actor, "payment.adjust");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = partialRefundSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: REFUND_INVALID_INPUT };
    }

    const loaded = await loadVisiblePayment(actor, paymentId, deps);
    if (!loaded.ok) {
      return loaded;
    }

    const { payment } = loaded.data;
    const existing = await deps.adjustments.listAdjustmentsByPayment(payment.id);
    assertConfirmedFinancialFieldsUnchanged(payment, {});

    const amounts = resolvePartialRefundAmounts({
      payment,
      invoiceAmount: parsed.data.invoiceAmount,
      actualSettlementAmount: parsed.data.actualSettlementAmount,
    });
    assertPaymentCanProcessPartialRefund(payment, existing, {
      invoiceAmount: amounts.invoiceAmount,
      settlementAmount: amounts.settlementAmount,
    });

    const scope = await enforceTransactionalCompanyScopeOf(actor, payment.companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    const providerRefund = await maybeRefundViaProvider(payment, amounts.settlementAmount, deps, {
      partial: true,
    });

    const now = nowOf(deps);
    const effectiveDate = parsed.data.effectiveDate ?? now;
    const createInput: PaymentAdjustmentCreateInput = {
      companyId: payment.companyId,
      paymentId: payment.id,
      type: "REFUND",
      status: "PROCESSED",
      amount: amounts.amount,
      invoiceAmount: amounts.invoiceAmount,
      settlementAmount: amounts.settlementAmount,
      reason: parsed.data.reason ?? null,
      merchantReference: parsed.data.merchantReference ?? null,
      notes: parsed.data.notes ?? null,
      effectiveDate,
      openedAt: null,
      processedAt: now,
      resolvedAt: now,
      createdByUserId: actor.userId,
    };

    const adjustment = await deps.adjustments.createAdjustment(createInput);
    assertProcessedRefundAdjustment(adjustment);
    assertConfirmedFinancialFieldsUnchanged(payment, {
      invoiceAmountApplied: payment.invoiceAmountApplied,
      convertedSettlementAmount: payment.convertedSettlementAmount,
      fixedConversionRate: payment.fixedConversionRate,
      processorFeeAmount: payment.processorFeeAmount,
      actualReceivedAmount: payment.actualReceivedAmount,
      invoiceCurrencyCode: payment.invoiceCurrencyCode,
      settlementCurrencyCode: payment.settlementCurrencyCode,
    });

    const listed = await deps.adjustments.listAdjustmentsByPayment(payment.id);
    const lifecycle = paymentRefundLifecycle(listed);
    if (lifecycle == null) {
      return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
    }

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: payment.companyId,
        entityType: AuditEntityTypes.PAYMENT_ADJUSTMENT,
        entityId: adjustment.id,
        action: AuditActions.PAYMENT_REFUND_PROCESSED,
        oldValues: paymentFinancialSnapshot(payment),
        newValues: {
          paymentId: payment.id,
          paymentStatus: payment.status,
          adjustmentId: adjustment.id,
          type: adjustment.type,
          status: adjustment.status,
          amount: adjustment.amount,
          invoiceAmount: adjustment.invoiceAmount,
          settlementAmount: adjustment.settlementAmount,
          reason: adjustment.reason,
          merchantReference: adjustment.merchantReference,
          lifecycle,
          partial: true,
          providerRefundId: providerRefund?.externalRefundId ?? null,
          usedMerchantActualSettlement: parsed.data.actualSettlementAmount != null,
        },
        reason: adjustment.reason,
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.partial_refund_processed",
        actorUserId: actor.userId,
        paymentId: payment.id,
        adjustmentId: adjustment.id,
        companyId: payment.companyId,
        settlementAmount: adjustment.settlementAmount,
        invoiceAmount: adjustment.invoiceAmount,
        providerRefundId: providerRefund?.externalRefundId ?? null,
      },
      "Partial refund processed as linked adjustment",
    );

    return { ok: true, data: { payment, adjustment, lifecycle, providerRefund } };
  } catch (error) {
    return toRefundError(error, "partial");
  }
}

function toRefundError(
  error: unknown,
  kind: "full" | "partial",
): {
  ok: false;
  status: 400 | 401 | 403 | 404 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return { ok: false, status: 403, error: PAYMENT_ADJUST_FORBIDDEN };
  }
  if (error instanceof Error) {
    if (
      error.message === REFUND_REQUIRES_SUCCESSFUL_PAYMENT ||
      error.message === REFUND_ALREADY_PROCESSED ||
      error.message === REFUND_EXCEEDS_PAYMENT ||
      error.message === REFUND_AMOUNT_INVALID ||
      error.message === PAYMENT_CONFIRMED_IMMUTABLE ||
      error.message === REFUND_INVALID_INPUT ||
      error.message === REFUND_SETTLEMENT_AMOUNT_INVALID
    ) {
      return { ok: false, status: 400, error: error.message };
    }
    if (error.message === REFUND_PROVIDER_FAILED) {
      return { ok: false, status: 503, error: REFUND_PROVIDER_FAILED };
    }
  }

  logger.error(
    {
      event: "payments.refund_unavailable",
      kind,
      err: error instanceof Error ? error.message : "unknown",
    },
    kind === "partial" ? "Partial refund failed" : "Full refund failed",
  );
  return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
}
