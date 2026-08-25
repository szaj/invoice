import "server-only";

import { logger } from "@/lib/logger";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError, GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { InvoiceRecord } from "@/domain/invoices/types";
import {
  ADJUSTMENT_ALREADY_CANCELLED,
  ADJUSTMENT_CANCEL_INVALID_INPUT,
  ADJUSTMENT_NOTE_INVALID_INPUT,
  ADJUSTMENT_NOTE_REQUIRES_SUCCESSFUL_PAYMENT,
  ADJUSTMENT_NOT_FOUND,
  PAYMENT_ADJUST_FORBIDDEN,
} from "@/domain/payments/adjustment-history";
import {
  assertAdjustmentCanBeCancelled,
  assertCancelledExcludedFromFinancialTotals,
  assertPaymentCanAddAdjustmentNote,
} from "@/domain/payments/adjustment-invariants";
import {
  adjustmentCancelSchema,
  adjustmentNoteCreateSchema,
  paymentAdjustmentIdSchema,
} from "@/domain/payments/adjustment-note-schema";
import { canViewPayment } from "@/domain/payments/access";
import {
  isCancelledAdjustment,
  isIncludedInFinancialTotals,
  type PaymentAdjustmentRecord,
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

export type AdjustmentHistoryServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 404 | 503; error: string };

export type ListPaymentAdjustmentsResult = {
  readonly payment: PaymentRecord;
  readonly adjustments: readonly PaymentAdjustmentRecord[];
};

export type AddAdjustmentNoteResult = {
  readonly payment: PaymentRecord;
  readonly adjustment: PaymentAdjustmentRecord;
};

export type CancelAdjustmentResult = {
  readonly payment: PaymentRecord;
  readonly adjustment: PaymentAdjustmentRecord;
};

export interface AdjustmentHistoryServiceDependencies {
  readonly payments: Pick<PrismaPaymentStore, "getPaymentById">;
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById">;
  readonly adjustments: Pick<
    PrismaPaymentAdjustmentStore,
    "createAdjustment" | "listAdjustmentsByPayment" | "getAdjustmentById" | "cancelAdjustment"
  >;
  readonly auditWriter?: AuditWriter;
  readonly now?: () => Date;
  readonly enforceTransactionalCompanyScope?: (
    actor: AuthorizationPrincipal,
    companyId: string,
  ) => Promise<AdjustmentHistoryServiceResult<true>>;
}

export function createDefaultAdjustmentHistoryServiceDependencies(): AdjustmentHistoryServiceDependencies {
  return {
    payments: new PrismaPaymentStore(),
    invoices: new PrismaInvoiceStore(),
    adjustments: new PrismaPaymentAdjustmentStore(),
  };
}

function auditWriterOf(deps: AdjustmentHistoryServiceDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function nowOf(deps: AdjustmentHistoryServiceDependencies): Date {
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
  deps: AdjustmentHistoryServiceDependencies,
): Promise<AdjustmentHistoryServiceResult<true>> {
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
  deps: AdjustmentHistoryServiceDependencies,
): Promise<AdjustmentHistoryServiceResult<{ payment: PaymentRecord; invoice: InvoiceRecord }>> {
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
 * List linked adjustments for a payment the actor can view (TASK-068).
 * Includes CANCELLED rows for audit history. View follows payment access — not payment.adjust.
 */
export async function listPaymentAdjustments(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  deps: AdjustmentHistoryServiceDependencies = createDefaultAdjustmentHistoryServiceDependencies(),
): Promise<AdjustmentHistoryServiceResult<ListPaymentAdjustmentsResult>> {
  try {
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const loaded = await loadVisiblePayment(actor, paymentId, deps);
    if (!loaded.ok) {
      return loaded;
    }

    const { payment } = loaded.data;
    const adjustments = await deps.adjustments.listAdjustmentsByPayment(payment.id);
    assertCancelledExcludedFromFinancialTotals(adjustments);

    return { ok: true, data: { payment, adjustments } };
  } catch (error) {
    return toAdjustmentHistoryError(error, "read");
  }
}

/**
 * Add an informational adjustment note on a SUCCESSFUL payment (TASK-068).
 * Creates NOTE + OPEN with zero amount. Does not rewrite the payment or affect CB/RF.
 * Requires payment.adjust.
 */
export async function addPaymentAdjustmentNote(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  input: unknown = {},
  deps: AdjustmentHistoryServiceDependencies = createDefaultAdjustmentHistoryServiceDependencies(),
): Promise<AdjustmentHistoryServiceResult<AddAdjustmentNoteResult>> {
  try {
    assertPermission(actor, "payment.adjust");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = adjustmentNoteCreateSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: ADJUSTMENT_NOTE_INVALID_INPUT };
    }

    const loaded = await loadVisiblePayment(actor, paymentId, deps);
    if (!loaded.ok) {
      return loaded;
    }

    const { payment } = loaded.data;
    assertPaymentCanAddAdjustmentNote(payment.status);
    assertConfirmedFinancialFieldsUnchanged(payment, {});

    const scope = await enforceTransactionalCompanyScopeOf(actor, payment.companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    const now = nowOf(deps);
    const createInput: PaymentAdjustmentCreateInput = {
      companyId: payment.companyId,
      paymentId: payment.id,
      type: "NOTE",
      status: "OPEN",
      amount: "0",
      invoiceAmount: null,
      settlementAmount: null,
      reason: parsed.data.reason ?? null,
      merchantReference: parsed.data.merchantReference ?? null,
      notes: parsed.data.notes,
      effectiveDate: now,
      openedAt: now,
      processedAt: null,
      resolvedAt: null,
      createdByUserId: actor.userId,
    };

    const adjustment = await deps.adjustments.createAdjustment(createInput);
    assertConfirmedFinancialFieldsUnchanged(payment, {
      invoiceAmountApplied: payment.invoiceAmountApplied,
      convertedSettlementAmount: payment.convertedSettlementAmount,
      fixedConversionRate: payment.fixedConversionRate,
      processorFeeAmount: payment.processorFeeAmount,
      actualReceivedAmount: payment.actualReceivedAmount,
      invoiceCurrencyCode: payment.invoiceCurrencyCode,
      settlementCurrencyCode: payment.settlementCurrencyCode,
    });

    if (isIncludedInFinancialTotals(adjustment)) {
      return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
    }

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: payment.companyId,
        entityType: AuditEntityTypes.PAYMENT_ADJUSTMENT,
        entityId: adjustment.id,
        action: AuditActions.PAYMENT_ADJUSTMENT_NOTE_ADDED,
        oldValues: paymentFinancialSnapshot(payment),
        newValues: {
          paymentId: payment.id,
          paymentStatus: payment.status,
          adjustmentId: adjustment.id,
          type: adjustment.type,
          status: adjustment.status,
          amount: adjustment.amount,
          reason: adjustment.reason,
          merchantReference: adjustment.merchantReference,
          notesLength: adjustment.notes?.length ?? 0,
        },
        reason: adjustment.reason,
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.adjustment_note_added",
        actorUserId: actor.userId,
        paymentId: payment.id,
        adjustmentId: adjustment.id,
        companyId: payment.companyId,
      },
      "Payment adjustment note added",
    );

    return { ok: true, data: { payment, adjustment } };
  } catch (error) {
    return toAdjustmentHistoryError(error, "write");
  }
}

/**
 * Cancel a linked adjustment (TASK-068). Sets status CANCELLED; retains the row for audit.
 * Excluded from financial totals. Never hard-deletes. Requires payment.adjust.
 */
export async function cancelPaymentAdjustment(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  adjustmentId: string,
  input: unknown = {},
  deps: AdjustmentHistoryServiceDependencies = createDefaultAdjustmentHistoryServiceDependencies(),
): Promise<AdjustmentHistoryServiceResult<CancelAdjustmentResult>> {
  try {
    assertPermission(actor, "payment.adjust");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = adjustmentCancelSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: ADJUSTMENT_CANCEL_INVALID_INPUT };
    }

    const loaded = await loadVisiblePayment(actor, paymentId, deps);
    if (!loaded.ok) {
      return loaded;
    }

    const { payment } = loaded.data;
    assertConfirmedFinancialFieldsUnchanged(payment, {});

    const parsedAdjId = paymentAdjustmentIdSchema.safeParse(adjustmentId);
    if (!parsedAdjId.success) {
      return { ok: false, status: 404, error: ADJUSTMENT_NOT_FOUND };
    }

    const existing = await deps.adjustments.getAdjustmentById(parsedAdjId.data);
    if (
      !existing ||
      existing.paymentId !== payment.id ||
      existing.companyId !== payment.companyId
    ) {
      return { ok: false, status: 404, error: ADJUSTMENT_NOT_FOUND };
    }

    assertAdjustmentCanBeCancelled(existing);

    const scope = await enforceTransactionalCompanyScopeOf(actor, payment.companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    const now = nowOf(deps);
    const previousStatus = existing.status;
    const adjustment = await deps.adjustments.cancelAdjustment({
      adjustmentId: existing.id,
      resolvedAt: now,
    });

    if (!isCancelledAdjustment(adjustment)) {
      return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
    }
    if (isIncludedInFinancialTotals(adjustment)) {
      return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
    }

    assertConfirmedFinancialFieldsUnchanged(payment, {
      invoiceAmountApplied: payment.invoiceAmountApplied,
      convertedSettlementAmount: payment.convertedSettlementAmount,
      fixedConversionRate: payment.fixedConversionRate,
      processorFeeAmount: payment.processorFeeAmount,
      actualReceivedAmount: payment.actualReceivedAmount,
      invoiceCurrencyCode: payment.invoiceCurrencyCode,
      settlementCurrencyCode: payment.settlementCurrencyCode,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: payment.companyId,
        entityType: AuditEntityTypes.PAYMENT_ADJUSTMENT,
        entityId: adjustment.id,
        action: AuditActions.PAYMENT_ADJUSTMENT_CANCELLED,
        oldValues: {
          ...paymentFinancialSnapshot(payment),
          adjustmentStatus: previousStatus,
          adjustmentType: existing.type,
          adjustmentAmount: existing.amount,
        },
        newValues: {
          paymentId: payment.id,
          paymentStatus: payment.status,
          adjustmentId: adjustment.id,
          type: adjustment.type,
          status: adjustment.status,
          amount: adjustment.amount,
          previousStatus,
          cancelNotes: parsed.data.notes ?? null,
        },
        reason: parsed.data.reason ?? null,
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.adjustment_cancelled",
        actorUserId: actor.userId,
        paymentId: payment.id,
        adjustmentId: adjustment.id,
        companyId: payment.companyId,
        previousStatus,
      },
      "Payment adjustment cancelled",
    );

    return { ok: true, data: { payment, adjustment } };
  } catch (error) {
    return toAdjustmentHistoryError(error, "write");
  }
}

function toAdjustmentHistoryError(
  error: unknown,
  kind: "read" | "write" = "write",
): {
  ok: false;
  status: 400 | 401 | 403 | 404 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      status: 403,
      error: kind === "write" ? PAYMENT_ADJUST_FORBIDDEN : GENERIC_FORBIDDEN,
    };
  }
  if (error instanceof Error) {
    if (
      error.message === ADJUSTMENT_NOTE_REQUIRES_SUCCESSFUL_PAYMENT ||
      error.message === PAYMENT_CONFIRMED_IMMUTABLE ||
      error.message === ADJUSTMENT_NOTE_INVALID_INPUT ||
      error.message === ADJUSTMENT_CANCEL_INVALID_INPUT ||
      error.message === ADJUSTMENT_ALREADY_CANCELLED
    ) {
      return { ok: false, status: 400, error: error.message };
    }
    if (error.message === ADJUSTMENT_NOT_FOUND) {
      return { ok: false, status: 404, error: error.message };
    }
  }

  logger.error(
    {
      event: "payments.adjustment_history_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Adjustment history operation failed",
  );
  return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
}
