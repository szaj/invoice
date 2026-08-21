import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { canViewInvoice } from "@/domain/invoices/access";
import {
  canCancelInvoiceStatus,
  INVOICE_ALREADY_CANCELLED,
  INVOICE_CANCEL_FORBIDDEN,
  INVOICE_CANCEL_REASON_REQUIRED,
  INVOICE_NOT_CANCELLABLE,
  invoiceCancelInputSchema,
} from "@/domain/invoices/cancellation";
import { assertInvoiceTransition, INVOICE_ILLEGAL_TRANSITION } from "@/domain/invoices/lifecycle";
import { invoiceIdSchema } from "@/domain/invoices/schema";
import {
  INVOICE_NOT_FOUND,
  INVOICE_UNAVAILABLE,
  type InvoiceRecord,
} from "@/domain/invoices/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";

export type InvoiceCancelResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface InvoiceCancelDependencies {
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById" | "cancelInvoice">;
  readonly auditWriter?: AuditWriter;
  readonly now?: () => Date;
}

export function createDefaultInvoiceCancelDependencies(): InvoiceCancelDependencies {
  return {
    invoices: new PrismaInvoiceStore(),
  };
}

function auditWriterOf(deps: InvoiceCancelDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

/**
 * Soft-cancel an invoice (TASK-038 / BR-012).
 * Requires mandatory reason. Staff cannot cancel. Financial totals and versions are preserved.
 */
export async function cancelInvoice(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  input: unknown,
  deps: InvoiceCancelDependencies = createDefaultInvoiceCancelDependencies(),
): Promise<InvoiceCancelResult<InvoiceRecord>> {
  try {
    assertPermission(actor, "invoice.cancel");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = invoiceIdSchema.safeParse(invoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const parsed = invoiceCancelInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: INVOICE_CANCEL_REASON_REQUIRED };
    }

    const invoice = await deps.invoices.getInvoiceById(parsedId.data);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    assertCompanyAccess(actor, invoice.companyId);
    if (!canViewInvoice(actor, invoice)) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    if (invoice.status === "CANCELLED") {
      return { ok: false, status: 400, error: INVOICE_ALREADY_CANCELLED };
    }
    if (!canCancelInvoiceStatus(invoice.status)) {
      return { ok: false, status: 400, error: INVOICE_NOT_CANCELLABLE };
    }

    assertInvoiceTransition(invoice.status, "CANCELLED");

    const cancelledAt = deps.now?.() ?? new Date();
    const cancelled = await deps.invoices.cancelInvoice(invoice.id, {
      reason: parsed.data.reason,
      cancelledAt,
      cancelledByUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: invoice.companyId,
        entityType: AuditEntityTypes.INVOICE,
        entityId: invoice.id,
        action: AuditActions.INVOICE_CANCELLED,
        reason: parsed.data.reason,
        oldValues: {
          status: invoice.status,
          invoiceNumber: invoice.invoiceNumber,
          outstandingAmount: invoice.outstandingAmount,
        },
        newValues: {
          status: "CANCELLED",
          cancellationReason: cancelled.cancellationReason,
          cancelledAt: cancelled.cancelledAt?.toISOString() ?? null,
          invoiceNumber: cancelled.invoiceNumber,
          outstandingAmount: cancelled.outstandingAmount,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "invoices.cancelled",
        actorUserId: actor.userId,
        invoiceId: invoice.id,
        companyId: invoice.companyId,
        previousStatus: invoice.status,
      },
      "Invoice cancelled",
    );

    return { ok: true, data: cancelled };
  } catch (error) {
    return toCancelError(error);
  }
}

function toCancelError(error: unknown): {
  ok: false;
  status: 400 | 403 | 404 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return { ok: false, status: 403, error: INVOICE_CANCEL_FORBIDDEN };
  }
  if (error instanceof Error && error.message === INVOICE_ILLEGAL_TRANSITION) {
    return { ok: false, status: 400, error: error.message };
  }
  logger.error(
    {
      event: "invoices.cancel_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Invoice cancellation failed",
  );
  return { ok: false, status: 503, error: INVOICE_UNAVAILABLE };
}
