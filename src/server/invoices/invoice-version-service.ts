import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { canViewInvoice } from "@/domain/invoices/access";
import { issuedInvoiceMetadataWriteSchema } from "@/domain/invoices/issued-metadata-schema";
import { invoiceIdSchema } from "@/domain/invoices/schema";
import {
  INVOICE_INVALID_INPUT,
  INVOICE_ISSUED_EDIT_BLOCKED,
  INVOICE_NOT_FOUND,
  INVOICE_UNAVAILABLE,
  type InvoiceRecord,
} from "@/domain/invoices/types";
import {
  buildInvoiceVersionSnapshot,
  INVOICE_ISSUED_FINANCIAL_EDIT_FORBIDDEN,
  INVOICE_ISSUED_METADATA_FORBIDDEN,
  INVOICE_VERSION_REASON_ISSUED,
  payloadContainsIssuedFinancialFields,
  type InvoiceVersionRecord,
} from "@/domain/invoices/versions";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { PrismaInvoiceVersionStore } from "@/server/invoices/invoice-version-repository";

export type InvoiceVersionResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface InvoiceVersionDependencies {
  readonly versions: Pick<
    PrismaInvoiceVersionStore,
    "listByInvoiceId" | "getNextVersionNo" | "createVersion"
  >;
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById" | "listLineItems" | "updateInvoice">;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultInvoiceVersionDependencies(): InvoiceVersionDependencies {
  return {
    versions: new PrismaInvoiceVersionStore(),
    invoices: new PrismaInvoiceStore(),
  };
}

function auditWriterOf(deps: InvoiceVersionDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

/**
 * Create immutable version snapshot for an invoice (typically on issue).
 * Does not mutate prior versions.
 */
export async function createInvoiceVersionSnapshot(
  actor: AuthorizationPrincipal,
  invoice: InvoiceRecord,
  reason: string | null = INVOICE_VERSION_REASON_ISSUED,
  deps: InvoiceVersionDependencies = createDefaultInvoiceVersionDependencies(),
): Promise<InvoiceVersionRecord> {
  const lineItems = await deps.invoices.listLineItems(invoice.id);
  const snapshot = buildInvoiceVersionSnapshot(invoice, lineItems);
  const versionNo = await deps.versions.getNextVersionNo(invoice.id);
  const created = await deps.versions.createVersion({
    invoiceId: invoice.id,
    versionNo,
    snapshot,
    reason,
    createdByUserId: actor.userId,
  });

  await recordAuditEventRequired(
    {
      actorType: "USER",
      actorUserId: actor.userId,
      companyId: invoice.companyId,
      entityType: AuditEntityTypes.INVOICE,
      entityId: invoice.id,
      action: AuditActions.INVOICE_VERSION_CREATED,
      newValues: {
        versionId: created.id,
        versionNo: created.versionNo,
        reason: created.reason,
        invoiceNumber: snapshot.invoiceNumber,
      },
    },
    auditWriterOf(deps),
  );

  logger.info(
    {
      event: "invoices.version_created",
      actorUserId: actor.userId,
      invoiceId: invoice.id,
      versionNo: created.versionNo,
    },
    "Invoice version snapshot created",
  );

  return created;
}

export async function listInvoiceVersions(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  deps: InvoiceVersionDependencies = createDefaultInvoiceVersionDependencies(),
): Promise<InvoiceVersionResult<InvoiceVersionRecord[]>> {
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
      throw new AuthorizationError("denied");
    }

    const versions = await deps.versions.listByInvoiceId(invoice.id);
    return { ok: true, data: versions };
  } catch (error) {
    return toVersionError(error);
  }
}

/**
 * Patch non-financial metadata on an issued (non-draft) invoice.
 * Financial fields are rejected. Staff cannot edit issued (invoice.edit_issued).
 * Does not create a new financial revision version (ADR-009 OPEN).
 */
export async function updateIssuedInvoiceMetadata(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  input: unknown,
  deps: InvoiceVersionDependencies = createDefaultInvoiceVersionDependencies(),
): Promise<InvoiceVersionResult<InvoiceRecord>> {
  try {
    if (payloadContainsIssuedFinancialFields(input)) {
      return { ok: false, status: 400, error: INVOICE_ISSUED_FINANCIAL_EDIT_FORBIDDEN };
    }

    assertPermission(actor, "invoice.edit_issued");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsedId = invoiceIdSchema.safeParse(invoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const existing = await deps.invoices.getInvoiceById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }
    if (existing.status === "DRAFT") {
      return { ok: false, status: 400, error: INVOICE_INVALID_INPUT };
    }

    assertCompanyAccess(actor, existing.companyId);

    const parsed = issuedInvoiceMetadataWriteSchema.safeParse(input);
    if (!parsed.success) {
      // Unknown keys in strict schema → treat as financial/forbidden attempt when financial keys present already handled
      return { ok: false, status: 400, error: INVOICE_ISSUED_FINANCIAL_EDIT_FORBIDDEN };
    }

    const updated = await deps.invoices.updateInvoice(
      existing.id,
      {
        companyId: existing.companyId,
        customerId: existing.customerId,
        invoiceNumber: existing.invoiceNumber,
        invoiceDate: existing.invoiceDate,
        dueDate: existing.dueDate,
        currencyCode: existing.currencyCode,
        referencePo: parsed.data.referencePo,
        assignedStaffUserId: parsed.data.assignedStaffUserId,
        status: existing.status,
        complianceStatus: existing.complianceStatus,
        internalNotes: parsed.data.internalNotes,
        customerNotes: parsed.data.customerNotes,
      },
      { updatedByUserId: actor.userId },
    );

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: existing.companyId,
        entityType: AuditEntityTypes.INVOICE,
        entityId: existing.id,
        action: AuditActions.INVOICE_METADATA_UPDATED,
        oldValues: {
          referencePo: existing.referencePo,
          assignedStaffUserId: existing.assignedStaffUserId,
          internalNotes: existing.internalNotes,
          customerNotes: existing.customerNotes,
        },
        newValues: {
          referencePo: updated.referencePo,
          assignedStaffUserId: updated.assignedStaffUserId,
          internalNotes: updated.internalNotes,
          customerNotes: updated.customerNotes,
        },
      },
      auditWriterOf(deps),
    );

    return { ok: true, data: updated };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: INVOICE_ISSUED_METADATA_FORBIDDEN };
    }
    return toVersionError(error);
  }
}

function toVersionError(error: unknown): {
  ok: false;
  status: 400 | 403 | 404 | 503;
  error: string;
} {
  if (error instanceof AuthorizationError) {
    return { ok: false, status: 403, error: error.message };
  }
  logger.error(
    {
      event: "invoices.versions_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Invoice version operation failed",
  );
  return { ok: false, status: 503, error: INVOICE_UNAVAILABLE };
}

export { INVOICE_ISSUED_EDIT_BLOCKED };
