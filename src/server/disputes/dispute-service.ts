import "server-only";

import { logger } from "@/lib/logger";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import {
  assertOpenDisputeHasNoFinancialEffect,
  assertPaymentCanOpenDispute,
} from "@/domain/disputes/invariants";
import { disputeOpenSchema } from "@/domain/disputes/schema";
import {
  DISPUTE_INVALID_INPUT,
  DISPUTE_REQUIRES_SUCCESSFUL_PAYMENT,
  PAYMENT_ADJUST_FORBIDDEN,
} from "@/domain/disputes/types";
import { canViewPayment } from "@/domain/payments/access";
import {
  paymentDisputeLifecycle,
  type PaymentAdjustmentRecord,
  type PaymentDisputeLifecycle,
} from "@/domain/payments/adjustments";
import { assertConfirmedFinancialFieldsUnchanged } from "@/domain/payments/invariants";
import { paymentIdSchema } from "@/domain/payments/schema";
import {
  PAYMENT_CONFIRMED_IMMUTABLE,
  PAYMENT_NOT_FOUND,
  PAYMENT_UNAVAILABLE,
  type PaymentRecord,
} from "@/domain/payments/types";
import type { InvoiceRecord } from "@/domain/invoices/types";
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

export type DisputeServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 404 | 503; error: string };

export type OpenDisputeResult = {
  readonly payment: PaymentRecord;
  readonly adjustment: PaymentAdjustmentRecord;
  readonly lifecycle: PaymentDisputeLifecycle;
};

export interface DisputeServiceDependencies {
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
  ) => Promise<DisputeServiceResult<true>>;
}

export function createDefaultDisputeServiceDependencies(): DisputeServiceDependencies {
  return {
    payments: new PrismaPaymentStore(),
    invoices: new PrismaInvoiceStore(),
    adjustments: new PrismaPaymentAdjustmentStore(),
  };
}

function auditWriterOf(deps: DisputeServiceDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function nowOf(deps: DisputeServiceDependencies): Date {
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
  deps: DisputeServiceDependencies,
): Promise<DisputeServiceResult<true>> {
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
  deps: DisputeServiceDependencies,
): Promise<DisputeServiceResult<{ payment: PaymentRecord; invoice: InvoiceRecord }>> {
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
 * Mark a SUCCESSFUL payment as disputed (TASK-063).
 * Creates a linked DISPUTE OPEN/UNDER_REVIEW adjustment. Does not rewrite the payment
 * or deduct outstanding/CB/RF (BR-005 / BR-023 / BR-024). Requires payment.adjust.
 */
export async function openPaymentDispute(
  actor: AuthorizationPrincipal | null,
  paymentId: string,
  input: unknown = {},
  deps: DisputeServiceDependencies = createDefaultDisputeServiceDependencies(),
): Promise<DisputeServiceResult<OpenDisputeResult>> {
  try {
    assertPermission(actor, "payment.adjust");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = disputeOpenSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: DISPUTE_INVALID_INPUT };
    }

    const loaded = await loadVisiblePayment(actor, paymentId, deps);
    if (!loaded.ok) {
      return loaded;
    }

    const { payment } = loaded.data;
    assertPaymentCanOpenDispute(payment.status);
    assertConfirmedFinancialFieldsUnchanged(payment, {});

    const scope = await enforceTransactionalCompanyScopeOf(actor, payment.companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    const now = nowOf(deps);
    const status = parsed.data.status ?? "OPEN";
    const createInput: PaymentAdjustmentCreateInput = {
      companyId: payment.companyId,
      paymentId: payment.id,
      type: "DISPUTE",
      status,
      amount: payment.invoiceAmountApplied,
      invoiceAmount: payment.invoiceAmountApplied,
      settlementAmount: payment.convertedSettlementAmount,
      reason: parsed.data.reason ?? null,
      merchantReference: parsed.data.merchantReference ?? null,
      notes: parsed.data.notes ?? null,
      effectiveDate: now,
      openedAt: now,
      processedAt: null,
      resolvedAt: null,
      createdByUserId: actor.userId,
    };

    const adjustment = await deps.adjustments.createAdjustment(createInput);
    assertOpenDisputeHasNoFinancialEffect(adjustment);
    assertConfirmedFinancialFieldsUnchanged(payment, {
      invoiceAmountApplied: payment.invoiceAmountApplied,
      convertedSettlementAmount: payment.convertedSettlementAmount,
      fixedConversionRate: payment.fixedConversionRate,
      processorFeeAmount: payment.processorFeeAmount,
      actualReceivedAmount: payment.actualReceivedAmount,
      invoiceCurrencyCode: payment.invoiceCurrencyCode,
      settlementCurrencyCode: payment.settlementCurrencyCode,
    });

    const existing = await deps.adjustments.listAdjustmentsByPayment(payment.id);
    const lifecycle = paymentDisputeLifecycle(existing);
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
        action: AuditActions.PAYMENT_DISPUTE_OPENED,
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
        },
        reason: adjustment.reason,
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "payments.dispute_opened",
        actorUserId: actor.userId,
        paymentId: payment.id,
        adjustmentId: adjustment.id,
        companyId: payment.companyId,
        status: adjustment.status,
      },
      "Payment marked as disputed",
    );

    return { ok: true, data: { payment, adjustment, lifecycle } };
  } catch (error) {
    return toDisputeError(error);
  }
}

function toDisputeError(error: unknown): {
  ok: false;
  status: 400 | 401 | 403 | 404 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return { ok: false, status: 403, error: PAYMENT_ADJUST_FORBIDDEN };
  }
  if (error instanceof Error) {
    if (
      error.message === DISPUTE_REQUIRES_SUCCESSFUL_PAYMENT ||
      error.message === PAYMENT_CONFIRMED_IMMUTABLE ||
      error.message === DISPUTE_INVALID_INPUT
    ) {
      return { ok: false, status: 400, error: error.message };
    }
  }

  logger.error(
    {
      event: "payments.dispute_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Dispute open failed",
  );
  return { ok: false, status: 503, error: PAYMENT_UNAVAILABLE };
}
