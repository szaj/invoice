import "server-only";

import { AuditActions, AuditEntityTypes, type AuditActorType } from "@/domain/audit/types";
import { computeInvoicePaymentAllocation } from "@/domain/invoices/allocation";
import { assertInvoiceTransition } from "@/domain/invoices/lifecycle";
import type { InvoiceRecord } from "@/domain/invoices/types";
import { logger } from "@/lib/logger";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import type { PrismaCurrencyStore } from "@/server/currencies/currency-repository";
import type { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import type { PrismaPaymentStore } from "@/server/payments/payment-repository";
import { PrismaSystemSettingsStore } from "@/server/settings/settings-repository";

export type InvoicePaymentAllocationDependencies = {
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById" | "updatePaymentAllocation">;
  readonly payments: Pick<PrismaPaymentStore, "listPayments">;
  readonly currencies: Pick<PrismaCurrencyStore, "findByCode">;
  readonly settings?: Pick<PrismaSystemSettingsStore, "getSettings">;
  readonly auditWriter?: AuditWriter;
};

/**
 * Recalculate invoice confirmed paid, outstanding, and status from SUCCESSFUL applications
 * (TASK-060 / BR-009). Settlement amounts and processor fees are ignored.
 * DRAFT / CANCELLED invoices are left unchanged.
 */
export async function allocateInvoiceFromConfirmedPayments(
  input: {
    readonly invoiceId: string;
    readonly companyId: string;
    readonly actorType: AuditActorType;
    readonly actorUserId?: string | null;
    readonly correlationId?: string | null;
  },
  deps: InvoicePaymentAllocationDependencies,
): Promise<InvoiceRecord | null> {
  const invoice = await deps.invoices.getInvoiceById(input.invoiceId);
  if (!invoice || invoice.companyId !== input.companyId) {
    return null;
  }

  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
    return invoice;
  }

  const currency = await deps.currencies.findByCode(invoice.currencyCode);
  const decimalPrecision = currency?.decimalPrecision ?? 2;
  const settingsStore = deps.settings ?? new PrismaSystemSettingsStore();
  const settings = await settingsStore.getSettings();
  const roundingTolerance = settings?.roundingTolerance ?? "0";

  const payments = await deps.payments.listPayments({
    companyIds: [invoice.companyId],
    invoiceId: invoice.id,
  });

  const allocation = computeInvoicePaymentAllocation({
    currentStatus: invoice.status,
    invoiceTotal: invoice.invoiceTotal,
    invoiceCurrencyCode: invoice.currencyCode,
    decimalPrecision,
    payments,
    roundingTolerance,
  });

  assertInvoiceTransition(invoice.status, allocation.status);

  const unchanged =
    invoice.confirmedPaidAmount === allocation.confirmedPaidAmount &&
    invoice.outstandingAmount === allocation.outstandingAmount &&
    invoice.status === allocation.status;
  if (unchanged) {
    return invoice;
  }

  const updated = await deps.invoices.updatePaymentAllocation(
    invoice.id,
    {
      confirmedPaidAmount: allocation.confirmedPaidAmount,
      outstandingAmount: allocation.outstandingAmount,
      status: allocation.status,
    },
    { updatedByUserId: input.actorUserId ?? null },
  );

  const auditWriter = deps.auditWriter ?? getAuditWriter();
  await recordAuditEventRequired(
    {
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      companyId: updated.companyId,
      entityType: AuditEntityTypes.INVOICE,
      entityId: updated.id,
      action: AuditActions.INVOICE_PAYMENT_ALLOCATED,
      correlationId: input.correlationId ?? null,
      oldValues: {
        status: invoice.status,
        confirmedPaidAmount: invoice.confirmedPaidAmount,
        outstandingAmount: invoice.outstandingAmount,
      },
      newValues: {
        status: updated.status,
        confirmedPaidAmount: updated.confirmedPaidAmount,
        outstandingAmount: updated.outstandingAmount,
      },
    },
    auditWriter,
  );

  logger.info(
    {
      event: "invoices.payment_allocated",
      invoiceId: updated.id,
      companyId: updated.companyId,
      status: updated.status,
      confirmedPaidAmount: updated.confirmedPaidAmount,
      outstandingAmount: updated.outstandingAmount,
    },
    "Invoice payment allocation recalculated",
  );

  return updated;
}
