import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { canStaffEditDraftInvoice } from "@/domain/invoices/access";
import {
  INVOICE_NUMBER_ALREADY_ASSIGNED,
  INVOICE_NUMBER_COLLISION,
  INVOICE_NUMBER_PREFIX_REQUIRED,
  rejectHandEditedInvoiceNumber,
} from "@/domain/invoices/numbering";
import { invoiceIdSchema } from "@/domain/invoices/schema";
import {
  INVOICE_DRAFT_EDIT_FORBIDDEN,
  INVOICE_INVALID_INPUT,
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
  PrismaInvoiceNumberStore,
  type AllocatedInvoiceNumber,
} from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";

export type InvoiceNumberResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 409 | 503; error: string };

export interface InvoiceNumberDependencies {
  readonly numbers: Pick<
    PrismaInvoiceNumberStore,
    "allocateNextInvoiceNumber" | "invoiceNumberExists" | "setInvoiceNumber"
  >;
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById">;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultInvoiceNumberDependencies(): InvoiceNumberDependencies {
  return {
    numbers: new PrismaInvoiceNumberStore(),
    invoices: new PrismaInvoiceStore(),
  };
}

function auditWriterOf(deps: InvoiceNumberDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

/**
 * Allocate the next company-scoped invoice number (transactional, never reused).
 * Does not attach to an invoice — used by issue (TASK-036) and concurrency tests.
 */
export async function allocateNextInvoiceNumber(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  deps: InvoiceNumberDependencies = createDefaultInvoiceNumberDependencies(),
): Promise<InvoiceNumberResult<AllocatedInvoiceNumber>> {
  try {
    assertPermission(actor, "invoice.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }
    assertCompanyAccess(actor, companyId);

    const allocated = await deps.numbers.allocateNextInvoiceNumber(companyId);
    return { ok: true, data: allocated };
  } catch (error) {
    return toNumberError(error);
  }
}

/**
 * Assign a system-generated number to an invoice that does not yet have one.
 * Numbering may be delayed until issue (TASK-036); this is the allocation step.
 * Hand-edited colliding numbers are rejected (BR-003).
 */
export async function assignInvoiceNumber(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  deps: InvoiceNumberDependencies = createDefaultInvoiceNumberDependencies(),
): Promise<InvoiceNumberResult<InvoiceRecord & { invoiceNumber: string }>> {
  try {
    assertPermission(actor, "invoice.edit_draft");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = invoiceIdSchema.safeParse(invoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const invoice = await deps.invoices.getInvoiceById(parsedId.data);
    if (!invoice) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    assertCompanyAccess(actor, invoice.companyId);
    if (!canStaffEditDraftInvoice(actor, invoice) && invoice.status === "DRAFT") {
      return { ok: false, status: 403, error: INVOICE_DRAFT_EDIT_FORBIDDEN };
    }

    if (invoice.invoiceNumber) {
      return {
        ok: true,
        data: { ...invoice, invoiceNumber: invoice.invoiceNumber },
      };
    }

    const allocated = await deps.numbers.allocateNextInvoiceNumber(invoice.companyId);
    if (await deps.numbers.invoiceNumberExists(invoice.companyId, allocated.invoiceNumber)) {
      return { ok: false, status: 409, error: INVOICE_NUMBER_COLLISION };
    }

    await deps.numbers.setInvoiceNumber(invoice.id, allocated.invoiceNumber);

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: invoice.companyId,
        entityType: AuditEntityTypes.INVOICE,
        entityId: invoice.id,
        action: AuditActions.INVOICE_NUMBER_ASSIGNED,
        newValues: {
          invoiceNumber: allocated.invoiceNumber,
          sequence: allocated.sequence,
          year: allocated.year,
          prefix: allocated.prefix,
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "invoices.number_assigned",
        actorUserId: actor.userId,
        invoiceId: invoice.id,
        companyId: invoice.companyId,
        invoiceNumber: allocated.invoiceNumber,
      },
      "Invoice number assigned",
    );

    return {
      ok: true,
      data: { ...invoice, invoiceNumber: allocated.invoiceNumber },
    };
  } catch (error) {
    return toNumberError(error);
  }
}

export { rejectHandEditedInvoiceNumber };

function toNumberError(error: unknown): {
  ok: false;
  status: 400 | 403 | 404 | 409 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return { ok: false, status: 403, error: error.message };
  }
  if (error instanceof Error) {
    if (error.message === INVOICE_NUMBER_PREFIX_REQUIRED) {
      return { ok: false, status: 400, error: error.message };
    }
    if (error.message === INVOICE_NUMBER_ALREADY_ASSIGNED) {
      return { ok: false, status: 400, error: error.message };
    }
    if (error.message === "Company not found.") {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }
    if (error.message.includes("Unique constraint") || error.message.includes("invoice_number")) {
      return { ok: false, status: 409, error: INVOICE_NUMBER_COLLISION };
    }
  }
  logger.error(
    {
      event: "invoices.numbering_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Invoice numbering failed",
  );
  return { ok: false, status: 503, error: INVOICE_UNAVAILABLE };
}

export { INVOICE_INVALID_INPUT };
