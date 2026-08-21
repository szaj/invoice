import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { canViewInvoice } from "@/domain/invoices/access";
import { invoiceIdSchema, toDateInputValue } from "@/domain/invoices/schema";
import {
  INVOICE_DUPLICATE_FAILED,
  INVOICE_DUPLICATE_FORBIDDEN,
  INVOICE_NOT_FOUND,
  INVOICE_UNAVAILABLE,
  type InvoiceRecord,
} from "@/domain/invoices/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import {
  createDraftInvoice,
  createDefaultInvoiceDraftDependencies,
  type InvoiceDraftDependencies,
  type InvoiceDraftResult,
} from "@/server/invoices/invoice-draft-service";
import {
  createDefaultInvoiceLineItemDependencies,
  listInvoiceLineItems,
  replaceDraftInvoiceLineItems,
  type InvoiceLineItemDependencies,
} from "@/server/invoices/invoice-line-item-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";

export type InvoiceDuplicateDependencies = {
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById">;
  readonly draft?: InvoiceDraftDependencies;
  readonly lineItems?: InvoiceLineItemDependencies;
  readonly auditWriter?: AuditWriter;
};

export function createDefaultInvoiceDuplicateDependencies(): InvoiceDuplicateDependencies {
  return {
    invoices: new PrismaInvoiceStore(),
    draft: createDefaultInvoiceDraftDependencies(),
    lineItems: createDefaultInvoiceLineItemDependencies(),
  };
}

function auditWriterOf(deps: InvoiceDuplicateDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

/**
 * Duplicate an invoice into a new Draft (TASK-043 / Invoices §8.5).
 *
 * Copied: company, customer, dates, currency, reference/PO, notes, line items.
 * Reset: id, invoice number (null until issue), status DRAFT, compliance NOT_REVIEWED,
 * payment totals (recomputed from lines), cancellation, versions, PDFs, email logs, audit history.
 * Assigned staff defaults to the duplicating actor (same as create draft).
 */
export async function duplicateInvoice(
  actor: AuthorizationPrincipal | null,
  sourceInvoiceId: string,
  deps: InvoiceDuplicateDependencies = createDefaultInvoiceDuplicateDependencies(),
): Promise<InvoiceDraftResult<InvoiceRecord>> {
  try {
    assertPermission(actor, "invoice.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = invoiceIdSchema.safeParse(sourceInvoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const source = await deps.invoices.getInvoiceById(parsedId.data);
    if (!source) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    assertCompanyAccess(actor, source.companyId);
    if (!canViewInvoice(actor, source)) {
      return { ok: false, status: 403, error: INVOICE_DUPLICATE_FORBIDDEN };
    }

    const draftDeps = deps.draft ?? createDefaultInvoiceDraftDependencies();
    const lineDeps = deps.lineItems ?? createDefaultInvoiceLineItemDependencies();

    const sourceLines = await listInvoiceLineItems(actor, source.id, lineDeps);
    if (!sourceLines.ok) {
      return { ok: false, status: sourceLines.status, error: sourceLines.error };
    }

    const created = await createDraftInvoice(
      actor,
      {
        companyId: source.companyId,
        customerId: source.customerId,
        invoiceDate: toDateInputValue(source.invoiceDate),
        dueDate: toDateInputValue(source.dueDate),
        currencyCode: source.currencyCode,
        referencePo: source.referencePo,
        assignedStaffUserId: actor.userId,
        complianceStatus: "NOT_REVIEWED",
        internalNotes: source.internalNotes,
        customerNotes: source.customerNotes,
      },
      draftDeps,
    );
    if (!created.ok) {
      return created;
    }

    if (sourceLines.data.length > 0) {
      const replaced = await replaceDraftInvoiceLineItems(
        actor,
        created.data.id,
        {
          lineItems: sourceLines.data.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitRate: item.unitRate,
            taxName: item.taxName,
            taxRatePercent: item.taxRatePercent,
          })),
        },
        lineDeps,
      );
      if (!replaced.ok) {
        return { ok: false, status: replaced.status, error: replaced.error };
      }
    }

    const duplicated = await deps.invoices.getInvoiceById(created.data.id);
    if (!duplicated) {
      return { ok: false, status: 503, error: INVOICE_DUPLICATE_FAILED };
    }

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: duplicated.companyId,
        entityType: AuditEntityTypes.INVOICE,
        entityId: duplicated.id,
        action: AuditActions.INVOICE_DUPLICATED,
        newValues: {
          sourceInvoiceId: source.id,
          sourceInvoiceNumber: source.invoiceNumber,
          sourceStatus: source.status,
          newInvoiceId: duplicated.id,
          status: duplicated.status,
          invoiceNumber: duplicated.invoiceNumber,
          lineItemCount: sourceLines.data.length,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "invoices.duplicated",
        actorUserId: actor.userId,
        sourceInvoiceId: source.id,
        invoiceId: duplicated.id,
        companyId: duplicated.companyId,
      },
      "Invoice duplicated as draft",
    );

    return { ok: true, data: duplicated };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: INVOICE_DUPLICATE_FORBIDDEN };
    }
    logger.error(
      {
        event: "invoices.duplicate_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Invoice duplicate failed",
    );
    return { ok: false, status: 503, error: INVOICE_UNAVAILABLE };
  }
}
