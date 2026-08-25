import "server-only";

import { logger } from "@/lib/logger";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import {
  assertChargebackDebitLossAdjustment,
  assertChargebackWonReversalAdjustment,
  assertPaymentCanRecordChargebackDebitLoss,
  assertPaymentCanRecordChargebackWonReversal,
  findChargebackDebitLoss,
  resolveChargebackDebitLossAmounts,
  resolveChargebackWonReversalAmounts,
} from "@/domain/chargebacks/invariants";
import {
  chargebackDebitLossSchema,
  chargebackWonReversalSchema,
} from "@/domain/chargebacks/schema";
import {
  CHARGEBACK_ALREADY_RECORDED,
  CHARGEBACK_EXCEEDS_PAYMENT,
  CHARGEBACK_INVALID_INPUT,
  CHARGEBACK_REQUIRES_SUCCESSFUL_PAYMENT,
  CHARGEBACK_SETTLEMENT_AMOUNT_INVALID,
  CHARGEBACK_WON_ALREADY_RECORDED,
  CHARGEBACK_WON_REQUIRES_DEBIT,
  CHARGEBACK_WON_REQUIRES_SUCCESSFUL_PAYMENT,
  PAYMENT_ADJUST_FORBIDDEN,
} from "@/domain/chargebacks/types";
import type { InvoiceRecord } from "@/domain/invoices/types";
import { canViewPayment } from "@/domain/payments/access";
import {
  paymentChargebackLifecycle,
  type PaymentAdjustmentRecord,
  type PaymentChargebackLifecycle,
} from "@/domain/payments/adjustments";
import { assertConfirmedFinancialFieldsUnchanged } from "@/domain/payments/invariants";
import { paymentIdSchema } from "@/domain/payments/schema";
import {
  PAYMENT_CONFIRMED_IMMUTABLE,
  PAYMENT_NOT_FOUND,
  PAYMENT_UNAVAILABLE,
  type PaymentRecord,
} from "@/domain/payments/types";
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

export type ChargebackServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 404 | 503; error: string };

export type RecordChargebackDebitLossResult = {
  readonly payment: PaymentRecord;
  readonly adjustment: PaymentAdjustmentRecord;
  readonly lifecycle: PaymentChargebackLifecycle;
};

export type RecordChargebackWonReversalResult = {
  readonly payment: PaymentRecord;
  readonly adjustment: PaymentAdjustmentRecord;
  readonly debitAdjustment: PaymentAdjustmentRecord;
  readonly lifecycle: PaymentChargebackLifecycle;
};

export interface ChargebackServiceDependencies {
  readonly payments: Pick<PrismaPaymentStore, "getPaymentById">;
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById">;
  readonly adjustments: Pick<
    PrismaPaymentAdjustmentStore,
    "createAdjustment" | "listAdjustmentsByPayment"
  >;
  readonly auditWriter?: AuditWriter;
  readonly now?: () => Date;
  readonly enforceTransactionalCompanyScope?: (
    actor: AuthorizationPrincipal,
    companyId: string,
  ) => Promise<ChargebackServiceResult<true>>;
}

export function createDefaultChargebackServiceDependencies(): ChargebackServiceDependencies {
  return {
    payments: new PrismaPaymentStore(),
    invoices: new PrismaInvoiceStore(),
    adjustments: new PrismaPaymentAdjustmentStore(),
  };
}

function auditWriterOf(deps: ChargebackServiceDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function nowOf(deps: ChargebackServiceDependencies): Date {
  return deps.now?.() ?? new Date();
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
  deps: ChargebackServiceDependencies,
): Promise<ChargebackServiceResult<true>> {
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
  deps: ChargebackServiceDependencies,
): Promise<ChargebackServiceResult<{ payment: PaymentRecord; invoice: InvoiceRecord }>> {
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
 * Record Chargeback Debit/Loss as a linked adjustment (TASK-066).
 * Creates CHARGEBACK + DEBITED/LOST. Original SUCCESSFUL payment is never rewritten (BR-023).
 * Settlement uses merchant actual when provided, else the payment fixed-rate snapshot (BR-025).
 * Included in CB/RF on the debit/loss effective date (BR-024). Requires payment.adjust.
 */
export async function recordChargebackDebitLoss(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  input: unknown = {},
  deps: ChargebackServiceDependencies = createDefaultChargebackServiceDependencies(),
): Promise<ChargebackServiceResult<RecordChargebackDebitLossResult>> {
  try {
    assertPermission(actor, "payment.adjust");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = chargebackDebitLossSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: CHARGEBACK_INVALID_INPUT };
    }

    const loaded = await loadVisiblePayment(actor, paymentId, deps);
    if (!loaded.ok) {
      return loaded;
    }

    const { payment } = loaded.data;
    const existing = await deps.adjustments.listAdjustmentsByPayment(payment.id);
    assertConfirmedFinancialFieldsUnchanged(payment, {});

    const amounts = resolveChargebackDebitLossAmounts({
      payment,
      actualSettlementAmount: parsed.data.actualSettlementAmount,
    });
    assertPaymentCanRecordChargebackDebitLoss(payment, existing, {
      invoiceAmount: amounts.invoiceAmount,
      settlementAmount: amounts.settlementAmount,
    });

    const scope = await enforceTransactionalCompanyScopeOf(actor, payment.companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    const now = nowOf(deps);
    const effectiveDate = parsed.data.effectiveDate ?? now;
    const status = parsed.data.status ?? "DEBITED";
    const createInput: PaymentAdjustmentCreateInput = {
      companyId: payment.companyId,
      paymentId: payment.id,
      type: "CHARGEBACK",
      status,
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
    assertChargebackDebitLossAdjustment(adjustment);
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
    const lifecycle = paymentChargebackLifecycle(listed);
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
        action: AuditActions.PAYMENT_CHARGEBACK_DEBITED,
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
          effectiveDate: adjustment.effectiveDate.toISOString().slice(0, 10),
          lifecycle,
          usedMerchantActualSettlement: parsed.data.actualSettlementAmount != null,
        },
        reason: adjustment.reason,
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.chargeback_debited",
        actorUserId: actor.userId,
        paymentId: payment.id,
        adjustmentId: adjustment.id,
        companyId: payment.companyId,
        status: adjustment.status,
        settlementAmount: adjustment.settlementAmount,
        effectiveDate: adjustment.effectiveDate.toISOString().slice(0, 10),
      },
      "Chargeback debit/loss recorded as linked adjustment",
    );

    return { ok: true, data: { payment, adjustment, lifecycle } };
  } catch (error) {
    return toChargebackError(error, "debit");
  }
}

/**
 * Record Chargeback Won/Reversal as a linked reversing adjustment (TASK-067 / E2E-16).
 * Creates REVERSAL + WON/REVERSED. Does not edit the original payment or debit row (BR-023).
 * Amounts default from the prior debit/loss; merchant actual settlement when provided (BR-025).
 * Subtracts from CB/RF to restore net impact (BR-024). Requires payment.adjust.
 */
export async function recordChargebackWonReversal(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  input: unknown = {},
  deps: ChargebackServiceDependencies = createDefaultChargebackServiceDependencies(),
): Promise<ChargebackServiceResult<RecordChargebackWonReversalResult>> {
  try {
    assertPermission(actor, "payment.adjust");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = chargebackWonReversalSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: CHARGEBACK_INVALID_INPUT };
    }

    const loaded = await loadVisiblePayment(actor, paymentId, deps);
    if (!loaded.ok) {
      return loaded;
    }

    const { payment } = loaded.data;
    const existing = await deps.adjustments.listAdjustmentsByPayment(payment.id);
    assertConfirmedFinancialFieldsUnchanged(payment, {});
    assertPaymentCanRecordChargebackWonReversal(payment, existing);

    const debitLoss = findChargebackDebitLoss(existing);
    if (!debitLoss) {
      return { ok: false, status: 400, error: CHARGEBACK_WON_REQUIRES_DEBIT };
    }

    const amounts = resolveChargebackWonReversalAmounts({
      debitLoss,
      actualSettlementAmount: parsed.data.actualSettlementAmount,
    });

    const scope = await enforceTransactionalCompanyScopeOf(actor, payment.companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    const now = nowOf(deps);
    const effectiveDate = parsed.data.effectiveDate ?? now;
    const status = parsed.data.status ?? "WON";
    const createInput: PaymentAdjustmentCreateInput = {
      companyId: payment.companyId,
      paymentId: payment.id,
      type: "REVERSAL",
      status,
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
    assertChargebackWonReversalAdjustment(adjustment);
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
    const lifecycle = paymentChargebackLifecycle(listed);
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
        action: AuditActions.PAYMENT_CHARGEBACK_WON,
        oldValues: {
          ...paymentFinancialSnapshot(payment),
          debitAdjustmentId: debitLoss.id,
          debitType: debitLoss.type,
          debitStatus: debitLoss.status,
          debitAmount: debitLoss.amount,
          debitSettlementAmount: debitLoss.settlementAmount,
        },
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
          effectiveDate: adjustment.effectiveDate.toISOString().slice(0, 10),
          lifecycle,
          debitAdjustmentId: debitLoss.id,
          usedMerchantActualSettlement: parsed.data.actualSettlementAmount != null,
        },
        reason: adjustment.reason,
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.chargeback_won",
        actorUserId: actor.userId,
        paymentId: payment.id,
        adjustmentId: adjustment.id,
        debitAdjustmentId: debitLoss.id,
        companyId: payment.companyId,
        status: adjustment.status,
        settlementAmount: adjustment.settlementAmount,
        effectiveDate: adjustment.effectiveDate.toISOString().slice(0, 10),
      },
      "Chargeback won/reversal recorded as linked reversing adjustment",
    );

    return {
      ok: true,
      data: { payment, adjustment, debitAdjustment: debitLoss, lifecycle },
    };
  } catch (error) {
    return toChargebackError(error, "won");
  }
}

function toChargebackError(
  error: unknown,
  kind: "debit" | "won",
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
      error.message === CHARGEBACK_REQUIRES_SUCCESSFUL_PAYMENT ||
      error.message === CHARGEBACK_ALREADY_RECORDED ||
      error.message === CHARGEBACK_EXCEEDS_PAYMENT ||
      error.message === CHARGEBACK_SETTLEMENT_AMOUNT_INVALID ||
      error.message === CHARGEBACK_WON_REQUIRES_DEBIT ||
      error.message === CHARGEBACK_WON_ALREADY_RECORDED ||
      error.message === CHARGEBACK_WON_REQUIRES_SUCCESSFUL_PAYMENT ||
      error.message === PAYMENT_CONFIRMED_IMMUTABLE ||
      error.message === CHARGEBACK_INVALID_INPUT
    ) {
      return { ok: false, status: 400, error: error.message };
    }
  }

  logger.error(
    {
      event:
        kind === "won"
          ? "payments.chargeback_won_unavailable"
          : "payments.chargeback_debit_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    kind === "won" ? "Chargeback won/reversal failed" : "Chargeback debit/loss failed",
  );
  return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
}
