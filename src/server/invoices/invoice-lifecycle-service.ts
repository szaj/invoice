import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { canIssueDraftInvoice, canViewInvoice } from "@/domain/invoices/access";
import {
  assertInvoiceTransition,
  evaluateOverdueStatus,
  INVOICE_ALREADY_ISSUED,
  INVOICE_DUE_DATE_REQUIRED,
  INVOICE_ILLEGAL_TRANSITION,
  INVOICE_ISSUE_FORBIDDEN,
  INVOICE_NOT_ISSUABLE,
} from "@/domain/invoices/lifecycle";
import {
  INVOICE_NUMBER_COLLISION,
  INVOICE_NUMBER_PREFIX_REQUIRED,
} from "@/domain/invoices/numbering";
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
import { PrismaInvoiceNumberStore } from "@/server/invoices/invoice-number-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import {
  createDefaultInvoiceVersionDependencies,
  createInvoiceVersionSnapshot,
  type InvoiceVersionDependencies,
} from "@/server/invoices/invoice-version-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { emitOperationalNotification } from "@/server/notifications/notification-service";

export type InvoiceLifecycleResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 409 | 503; error: string };

export interface InvoiceLifecycleDependencies {
  readonly invoices: Pick<
    PrismaInvoiceStore,
    "getInvoiceById" | "updateInvoiceStatus" | "listInvoices" | "listLineItems"
  >;
  readonly numbers: Pick<
    PrismaInvoiceNumberStore,
    "allocateNextInvoiceNumber" | "invoiceNumberExists" | "setInvoiceNumber"
  >;
  readonly versions?: InvoiceVersionDependencies;
  readonly auditWriter?: AuditWriter;
  /** Optional clock for overdue evaluation (tests). */
  readonly now?: () => Date;
  /** When true, skip best-effort PDF generation after issue (tests). */
  readonly skipPdfGeneration?: boolean;
  readonly customers?: Pick<PrismaCustomerStore, "getCustomerById">;
}

export function createDefaultInvoiceLifecycleDependencies(): InvoiceLifecycleDependencies {
  return {
    invoices: new PrismaInvoiceStore(),
    numbers: new PrismaInvoiceNumberStore(),
    versions: createDefaultInvoiceVersionDependencies(),
  };
}

function auditWriterOf(deps: InvoiceLifecycleDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function nowOf(deps: InvoiceLifecycleDependencies): Date {
  return deps.now?.() ?? new Date();
}

async function emitInvoiceOverdueNotification(
  invoice: InvoiceRecord,
  deps: InvoiceLifecycleDependencies,
): Promise<void> {
  const customerStore = deps.customers ?? new PrismaCustomerStore();
  const customer = await customerStore.getCustomerById(invoice.customerId);
  await emitOperationalNotification({
    kind: "INVOICE_OVERDUE",
    companyId: invoice.companyId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: customer?.displayName ?? "Customer",
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    balanceDue: invoice.outstandingAmount,
    currencyCode: invoice.currencyCode,
    assignedStaffUserId: invoice.assignedStaffUserId,
  });
}

/**
 * Issue a draft invoice: allocate number if needed, transition DRAFT → ISSUED (TASK-036).
 * Cancel is TASK-038 (`cancelInvoice`). Paid/partial transitions require payment records (excluded).
 */
export async function issueInvoice(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  deps: InvoiceLifecycleDependencies = createDefaultInvoiceLifecycleDependencies(),
): Promise<InvoiceLifecycleResult<InvoiceRecord>> {
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

    if (invoice.status !== "DRAFT") {
      if (invoice.status === "ISSUED" || invoice.status === "OVERDUE") {
        return { ok: false, status: 400, error: INVOICE_ALREADY_ISSUED };
      }
      return { ok: false, status: 400, error: INVOICE_NOT_ISSUABLE };
    }

    if (!canIssueDraftInvoice(actor, invoice)) {
      return { ok: false, status: 403, error: INVOICE_ISSUE_FORBIDDEN };
    }

    if (!(invoice.dueDate instanceof Date) || Number.isNaN(invoice.dueDate.getTime())) {
      return { ok: false, status: 400, error: INVOICE_DUE_DATE_REQUIRED };
    }

    assertInvoiceTransition("DRAFT", "ISSUED");

    let invoiceNumber = invoice.invoiceNumber;
    if (!invoiceNumber) {
      const allocated = await deps.numbers.allocateNextInvoiceNumber(invoice.companyId);
      if (await deps.numbers.invoiceNumberExists(invoice.companyId, allocated.invoiceNumber)) {
        return { ok: false, status: 409, error: INVOICE_NUMBER_COLLISION };
      }
      await deps.numbers.setInvoiceNumber(invoice.id, allocated.invoiceNumber);
      invoiceNumber = allocated.invoiceNumber;

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
    }

    const issued = await deps.invoices.updateInvoiceStatus(invoice.id, "ISSUED", {
      updatedByUserId: actor.userId,
    });

    const issuedRecord: InvoiceRecord = { ...issued, invoiceNumber };

    const versionDeps = deps.versions ?? createDefaultInvoiceVersionDependencies();
    const version = await createInvoiceVersionSnapshot(actor, issuedRecord, undefined, versionDeps);

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: invoice.companyId,
        entityType: AuditEntityTypes.INVOICE,
        entityId: invoice.id,
        action: AuditActions.INVOICE_ISSUED,
        oldValues: { status: "DRAFT", invoiceNumber: invoice.invoiceNumber },
        newValues: { status: "ISSUED", invoiceNumber },
      },
      auditWriterOf(deps),
    );

    // Best-effort PDF (TASK-039). Issue success does not depend on PDF; failures are logged.
    if (!deps.skipPdfGeneration) {
      try {
        const { enqueueInvoicePdfGeneration } =
          await import("@/server/invoices/invoice-pdf-service");
        const pdfResult = await enqueueInvoicePdfGeneration(actor, {
          invoiceId: invoice.id,
          invoiceVersionId: version.id,
        });
        if (!pdfResult.ok) {
          logger.error(
            {
              event: "invoices.pdf_after_issue_failed",
              invoiceId: invoice.id,
              invoiceVersionId: version.id,
              error: pdfResult.error,
            },
            "Invoice PDF generation after issue failed",
          );
        }
      } catch (error) {
        logger.error(
          {
            event: "invoices.pdf_after_issue_failed",
            invoiceId: invoice.id,
            err: error instanceof Error ? error.message : "unknown",
          },
          "Invoice PDF generation after issue failed",
        );
      }
    }

    logger.info(
      {
        event: "invoices.issued",
        actorUserId: actor.userId,
        invoiceId: invoice.id,
        companyId: invoice.companyId,
        invoiceNumber,
      },
      "Invoice issued",
    );

    return { ok: true, data: issuedRecord };
  } catch (error) {
    return toLifecycleError(error);
  }
}

/**
 * Apply BR-018 overdue marking for one invoice when conditions hold.
 */
export async function refreshInvoiceOverdueStatus(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  deps: InvoiceLifecycleDependencies = createDefaultInvoiceLifecycleDependencies(),
): Promise<InvoiceLifecycleResult<InvoiceRecord>> {
  try {
    assertPermission(actor, "invoice.create");
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
    if (!canViewInvoice(actor, invoice)) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const next = evaluateOverdueStatus(invoice, nowOf(deps));
    if (next == null || next === invoice.status) {
      return { ok: true, data: invoice };
    }

    assertInvoiceTransition(invoice.status, next);
    const updated = await deps.invoices.updateInvoiceStatus(invoice.id, next, {
      updatedByUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: invoice.companyId,
        entityType: AuditEntityTypes.INVOICE,
        entityId: invoice.id,
        action: AuditActions.INVOICE_OVERDUE_MARKED,
        oldValues: { status: invoice.status },
        newValues: { status: next },
      },
      auditWriterOf(deps),
    );

    await emitInvoiceOverdueNotification(updated, deps);

    return { ok: true, data: updated };
  } catch (error) {
    return toLifecycleError(error);
  }
}

/**
 * Best-effort overdue refresh for a list of invoices (persists when BR-018 applies).
 */
export async function applyOverdueToInvoiceList(
  actor: AuthorizationPrincipal,
  invoices: readonly InvoiceRecord[],
  deps: InvoiceLifecycleDependencies = createDefaultInvoiceLifecycleDependencies(),
): Promise<InvoiceRecord[]> {
  const asOf = nowOf(deps);
  const result: InvoiceRecord[] = [];
  for (const invoice of invoices) {
    const next = evaluateOverdueStatus(invoice, asOf);
    if (
      next != null &&
      next !== invoice.status &&
      canTransitionInvoiceStatusSafe(invoice.status, next)
    ) {
      try {
        const updated = await deps.invoices.updateInvoiceStatus(invoice.id, next, {
          updatedByUserId: actor.userId,
        });
        await recordAuditEventRequired(
          {
            actorType: "USER",
            actorUserId: actor.userId,
            companyId: invoice.companyId,
            entityType: AuditEntityTypes.INVOICE,
            entityId: invoice.id,
            action: AuditActions.INVOICE_OVERDUE_MARKED,
            oldValues: { status: invoice.status },
            newValues: { status: next },
          },
          auditWriterOf(deps),
        );
        await emitInvoiceOverdueNotification(updated, deps);
        result.push(updated);
      } catch {
        result.push(invoice);
      }
    } else {
      result.push(invoice);
    }
  }
  return result;
}

function canTransitionInvoiceStatusSafe(
  from: InvoiceRecord["status"],
  to: InvoiceRecord["status"],
): boolean {
  try {
    assertInvoiceTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

function toLifecycleError(error: unknown): {
  ok: false;
  status: 400 | 403 | 404 | 409 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return { ok: false, status: 403, error: error.message };
  }
  if (error instanceof Error) {
    if (
      error.message === INVOICE_ILLEGAL_TRANSITION ||
      error.message === INVOICE_NOT_ISSUABLE ||
      error.message === INVOICE_ALREADY_ISSUED ||
      error.message === INVOICE_DUE_DATE_REQUIRED ||
      error.message === INVOICE_NUMBER_PREFIX_REQUIRED
    ) {
      return { ok: false, status: 400, error: error.message };
    }
    if (error.message === INVOICE_NUMBER_COLLISION) {
      return { ok: false, status: 409, error: error.message };
    }
  }
  logger.error(
    {
      event: "invoices.lifecycle_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Invoice lifecycle operation failed",
  );
  return { ok: false, status: 503, error: INVOICE_UNAVAILABLE };
}
