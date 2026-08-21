import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { canStaffEditDraftInvoice, canViewInvoice } from "@/domain/invoices/access";
import { invoiceLineItemsReplaceSchema } from "@/domain/invoices/line-item-schema";
import { computeInvoiceLineTotal, type InvoiceLineItemRecord } from "@/domain/invoices/line-items";
import { computeInvoiceTotals } from "@/domain/invoices/totals";
import { invoiceIdSchema } from "@/domain/invoices/schema";
import {
  INVOICE_DRAFT_EDIT_FORBIDDEN,
  INVOICE_INVALID_INPUT,
  INVOICE_NOT_DRAFT,
  INVOICE_NOT_FOUND,
  INVOICE_UNAVAILABLE,
} from "@/domain/invoices/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaCurrencyStore } from "@/server/currencies/currency-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";

export type InvoiceLineItemsResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface InvoiceLineItemDependencies {
  readonly store: Pick<PrismaInvoiceStore, "getInvoiceById" | "listLineItems" | "replaceLineItems">;
  readonly currencyStore: Pick<PrismaCurrencyStore, "findByCode">;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultInvoiceLineItemDependencies(): InvoiceLineItemDependencies {
  return {
    store: new PrismaInvoiceStore(),
    currencyStore: new PrismaCurrencyStore(),
  };
}

function auditWriterOf(deps: InvoiceLineItemDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function lineItemsAuditSnapshot(items: readonly InvoiceLineItemRecord[]) {
  return items.map((item) => ({
    id: item.id,
    sortOrder: item.sortOrder,
    description: item.description,
    quantity: item.quantity,
    unitRate: item.unitRate,
    taxName: item.taxName,
    taxRatePercent: item.taxRatePercent,
    lineTotal: item.lineTotal,
  }));
}

export async function listInvoiceLineItems(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  deps: InvoiceLineItemDependencies = createDefaultInvoiceLineItemDependencies(),
): Promise<InvoiceLineItemsResult<InvoiceLineItemRecord[]>> {
  try {
    assertPermission(actor, "invoice.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = invoiceIdSchema.safeParse(invoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const invoice = await deps.store.getInvoiceById(parsedId.data);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }
    assertCompanyAccess(actor, invoice.companyId);
    if (!canViewInvoice(actor, invoice)) {
      throw new AuthorizationError("denied");
    }

    const items = await deps.store.listLineItems(parsedId.data);
    return { ok: true, data: items };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

/**
 * Nested replace of draft line items. Client-supplied lineTotal is ignored;
 * totals are computed server-side with Decimal math (ADR-004).
 */
export async function replaceDraftInvoiceLineItems(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  input: unknown,
  deps: InvoiceLineItemDependencies = createDefaultInvoiceLineItemDependencies(),
): Promise<InvoiceLineItemsResult<InvoiceLineItemRecord[]>> {
  try {
    assertPermission(actor, "invoice.edit_draft");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = invoiceIdSchema.safeParse(invoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const invoice = await deps.store.getInvoiceById(parsedId.data);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }
    if (invoice.status !== "DRAFT") {
      return { ok: false, status: 400, error: INVOICE_NOT_DRAFT };
    }

    assertCompanyAccess(actor, invoice.companyId);
    if (!canStaffEditDraftInvoice(actor, invoice)) {
      return { ok: false, status: 403, error: INVOICE_DRAFT_EDIT_FORBIDDEN };
    }

    const parsed = invoiceLineItemsReplaceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: INVOICE_INVALID_INPUT };
    }

    const currency = await deps.currencyStore.findByCode(invoice.currencyCode);
    if (!currency) {
      return { ok: false, status: 400, error: INVOICE_INVALID_INPUT };
    }

    const previous = await deps.store.listLineItems(parsedId.data);
    const prepared = parsed.data.lineItems.map((item, index) => {
      const lineTotal = computeInvoiceLineTotal({
        quantity: item.quantity,
        unitRate: item.unitRate,
        decimalPrecision: currency.decimalPrecision,
      });
      return {
        sortOrder: index,
        description: item.description,
        quantity: item.quantity,
        unitRate: item.unitRate,
        taxName: item.taxName,
        taxRatePercent: item.taxRatePercent,
        lineTotal,
      };
    });

    // Confirmed payment applications do not exist yet — paid/outstanding use empty applications (BR-009).
    const totals = computeInvoiceTotals({
      currencyCode: invoice.currencyCode,
      decimalPrecision: currency.decimalPrecision,
      lineItems: prepared.map((item) => ({
        lineTotal: item.lineTotal,
        taxRatePercent: item.taxRatePercent,
      })),
      confirmedApplications: [],
    });

    const replaced = await deps.store.replaceLineItems(parsedId.data, prepared, totals, {
      updatedByUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: invoice.companyId,
        entityType: AuditEntityTypes.INVOICE,
        entityId: invoice.id,
        action: AuditActions.INVOICE_LINE_ITEMS_UPDATED,
        oldValues: { lineItems: lineItemsAuditSnapshot(previous) },
        newValues: {
          lineItems: lineItemsAuditSnapshot(replaced),
          totals: {
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            invoiceTotal: totals.invoiceTotal,
            confirmedPaidAmount: totals.confirmedPaidAmount,
            outstandingAmount: totals.outstandingAmount,
          },
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "invoices.line_items_updated",
        actorUserId: actor.userId,
        invoiceId: invoice.id,
        companyId: invoice.companyId,
        lineItemCount: replaced.length,
      },
      "Draft invoice line items replaced",
    );

    return { ok: true, data: replaced };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

function toAuthzOrUnavailable(error: unknown): {
  ok: false;
  status: 400 | 403 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return { ok: false, status: 403, error: error.message };
  }
  if (error instanceof Error) {
    if (
      error.message.includes("quantity") ||
      error.message.includes("unit rate") ||
      error.message.includes("Tax rate")
    ) {
      return { ok: false, status: 400, error: error.message };
    }
  }
  logger.error(
    {
      event: "invoices.line_items_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Invoice line item management failed",
  );
  return { ok: false, status: 503, error: INVOICE_UNAVAILABLE };
}
