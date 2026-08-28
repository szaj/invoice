import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { canAccessCustomer, CustomerDomainError } from "@/domain/customers/access";
import { customerAllowsNewInvoice } from "@/domain/customers/duplicates";
import { canStaffEditDraftInvoice, canViewInvoice } from "@/domain/invoices/access";
import type { ListPage } from "@/domain/lists/pagination";
import { listPageOf, resolveListPagination } from "@/domain/lists/pagination";
import {
  invoiceDraftListQuerySchema,
  invoiceDraftWriteSchema,
  invoiceIdSchema,
  resolveInvoiceListQuery,
  toInvoiceHeaderWriteFromDraft,
} from "@/domain/invoices/schema";
import {
  INVOICE_CUSTOMER_INACTIVE,
  INVOICE_CUSTOMER_NOT_LINKED,
  INVOICE_DRAFT_EDIT_FORBIDDEN,
  INVOICE_INVALID_INPUT,
  INVOICE_NOT_DRAFT,
  INVOICE_NOT_FOUND,
  INVOICE_UNAVAILABLE,
  type InvoiceRecord,
} from "@/domain/invoices/types";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import {
  validateCurrencyCodeForNewDocument,
  type CurrencySelectionDependencies,
  createDefaultCurrencySelectionDependencies,
} from "@/server/currencies/currency-selection-service";
import { rejectHandEditedInvoiceNumber } from "@/domain/invoices/numbering";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";

export type InvoiceDraftResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface InvoiceDraftDependencies {
  readonly store: Pick<
    PrismaInvoiceStore,
    "listInvoicesPage" | "getInvoiceById" | "createInvoice" | "updateInvoice"
  >;
  readonly customerStore: Pick<PrismaCustomerStore, "getCustomerById">;
  readonly currencySelection?: CurrencySelectionDependencies;
  readonly auditWriter?: AuditWriter;
}

export function createDefaultInvoiceDraftDependencies(): InvoiceDraftDependencies {
  return {
    store: new PrismaInvoiceStore(),
    customerStore: new PrismaCustomerStore(),
    currencySelection: createDefaultCurrencySelectionDependencies(),
  };
}

function auditWriterOf(deps: InvoiceDraftDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

function invoiceAuditSnapshot(invoice: InvoiceRecord) {
  return {
    id: invoice.id,
    companyId: invoice.companyId,
    customerId: invoice.customerId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    currencyCode: invoice.currencyCode,
    referencePo: invoice.referencePo,
    assignedStaffUserId: invoice.assignedStaffUserId,
    status: invoice.status,
    complianceStatus: invoice.complianceStatus,
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    taxTotal: invoice.taxTotal,
    invoiceTotal: invoice.invoiceTotal,
    confirmedPaidAmount: invoice.confirmedPaidAmount,
    outstandingAmount: invoice.outstandingAmount,
  };
}

function accessibleCompanyIds(actor: AuthorizationPrincipal): string[] | "ALL" {
  const scope = companyScopeForRole(actor.roleCode);
  if (scope === "ALL") {
    return "ALL";
  }
  return [...assignedCompanyIdsOf(actor)];
}

function assertInvoiceCompanyAccess(actor: AuthorizationPrincipal, companyId: string): void {
  assertCompanyAccess(actor, companyId);
}

async function assertDraftCustomerAndCurrency(
  companyId: string,
  customerId: string,
  currencyCode: string,
  deps: InvoiceDraftDependencies,
  options: { readonly requireActiveCustomer: boolean },
): Promise<InvoiceDraftResult<never> | null> {
  const customer = await deps.customerStore.getCustomerById(customerId);
  if (!customer) {
    return { ok: false, status: 400, error: INVOICE_INVALID_INPUT };
  }
  if (!customer.companyIds.includes(companyId)) {
    return { ok: false, status: 400, error: INVOICE_CUSTOMER_NOT_LINKED };
  }
  if (options.requireActiveCustomer) {
    if (!customerAllowsNewInvoice(customer.status)) {
      return {
        ok: false,
        status: 400,
        error: INVOICE_CUSTOMER_INACTIVE,
      };
    }
  }

  const currency = await validateCurrencyCodeForNewDocument(
    companyId,
    currencyCode,
    deps.currencySelection,
  );
  if (!currency.ok) {
    return {
      ok: false,
      status: currency.status === 404 ? 400 : currency.status,
      error: currency.error,
    };
  }
  return null;
}

export async function listDraftInvoices(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: InvoiceDraftDependencies = createDefaultInvoiceDraftDependencies(),
): Promise<InvoiceDraftResult<ListPage<InvoiceRecord>>> {
  try {
    assertPermission(actor, "invoice.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = invoiceDraftListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: INVOICE_INVALID_INPUT };
    }

    const resolved = resolveInvoiceListQuery(parsed.data);
    const pagination = resolveListPagination({
      page: resolved.page,
      pageSize: resolved.pageSize,
    });

    const accessible = accessibleCompanyIds(actor);
    let companyIds: string[];
    if (resolved.companyId) {
      assertInvoiceCompanyAccess(actor, resolved.companyId);
      companyIds = [resolved.companyId];
    } else if (accessible === "ALL") {
      return { ok: false, status: 400, error: INVOICE_INVALID_INPUT };
    } else {
      companyIds = accessible;
    }

    const staffUserId = actor.roleCode === "STAFF" ? actor.userId : null;
    const page = await deps.store.listInvoicesPage({
      companyIds,
      status: resolved.status,
      q: resolved.q,
      visibleToStaffUserId: staffUserId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy: resolved.sortBy,
      sortDir: resolved.sortDir,
    });
    const visible = page.rows.filter((row) => canViewInvoice(actor, row));
    return { ok: true, data: listPageOf(visible, page.totalCount, pagination) };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function getDraftInvoice(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  deps: InvoiceDraftDependencies = createDefaultInvoiceDraftDependencies(),
): Promise<InvoiceDraftResult<InvoiceRecord>> {
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

    assertInvoiceCompanyAccess(actor, invoice.companyId);
    if (!canViewInvoice(actor, invoice)) {
      throw new AuthorizationError("denied");
    }

    return { ok: true, data: invoice };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function createDraftInvoice(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: InvoiceDraftDependencies = createDefaultInvoiceDraftDependencies(),
): Promise<InvoiceDraftResult<InvoiceRecord>> {
  try {
    assertPermission(actor, "invoice.create");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const handEdit = rejectHandEditedInvoiceNumber(input);
    if (handEdit) {
      return { ok: false, status: 400, error: handEdit.error };
    }

    const parsed = invoiceDraftWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: INVOICE_INVALID_INPUT };
    }

    assertInvoiceCompanyAccess(actor, parsed.data.companyId);

    const customer = await deps.customerStore.getCustomerById(parsed.data.customerId);
    if (!customer || !canAccessCustomer(actor, customer)) {
      return { ok: false, status: 400, error: INVOICE_INVALID_INPUT };
    }

    const blocked = await assertDraftCustomerAndCurrency(
      parsed.data.companyId,
      parsed.data.customerId,
      parsed.data.currencyCode,
      deps,
      { requireActiveCustomer: true },
    );
    if (blocked) {
      return blocked;
    }

    const assignedStaffUserId = parsed.data.assignedStaffUserId ?? actor.userId;
    const writeInput = toInvoiceHeaderWriteFromDraft(parsed.data, {
      assignedStaffUserId,
      status: "DRAFT",
      complianceStatus: "NOT_REVIEWED",
    });

    const created = await deps.store.createInvoice(writeInput, {
      createdByUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: created.companyId,
        entityType: AuditEntityTypes.INVOICE,
        entityId: created.id,
        action: AuditActions.INVOICE_CREATED,
        newValues: invoiceAuditSnapshot(created),
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "invoices.created",
        actorUserId: actor.userId,
        invoiceId: created.id,
        companyId: created.companyId,
        customerId: created.customerId,
      },
      "Draft invoice created",
    );

    return { ok: true, data: created };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function updateDraftInvoice(
  actor: AuthorizationPrincipal | null,
  invoiceId: string,
  input: unknown,
  deps: InvoiceDraftDependencies = createDefaultInvoiceDraftDependencies(),
): Promise<InvoiceDraftResult<InvoiceRecord>> {
  try {
    assertPermission(actor, "invoice.edit_draft");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const handEdit = rejectHandEditedInvoiceNumber(input);
    if (handEdit) {
      return { ok: false, status: 400, error: handEdit.error };
    }

    const parsedId = invoiceIdSchema.safeParse(invoiceId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }

    const existing = await deps.store.getInvoiceById(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: INVOICE_NOT_FOUND };
    }
    if (existing.status !== "DRAFT") {
      return { ok: false, status: 400, error: INVOICE_NOT_DRAFT };
    }

    assertInvoiceCompanyAccess(actor, existing.companyId);
    if (!canStaffEditDraftInvoice(actor, existing)) {
      return { ok: false, status: 403, error: INVOICE_DRAFT_EDIT_FORBIDDEN };
    }

    const parsed = invoiceDraftWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: INVOICE_INVALID_INPUT };
    }

    assertInvoiceCompanyAccess(actor, parsed.data.companyId);

    const customer = await deps.customerStore.getCustomerById(parsed.data.customerId);
    if (!customer || !canAccessCustomer(actor, customer)) {
      return { ok: false, status: 400, error: INVOICE_INVALID_INPUT };
    }

    // Changing customer on a draft still requires an active customer for new invoice work.
    const blocked = await assertDraftCustomerAndCurrency(
      parsed.data.companyId,
      parsed.data.customerId,
      parsed.data.currencyCode,
      deps,
      { requireActiveCustomer: true },
    );
    if (blocked) {
      return blocked;
    }

    const assignedStaffUserId =
      parsed.data.assignedStaffUserId ?? existing.assignedStaffUserId ?? existing.createdByUserId;
    const writeInput = {
      ...toInvoiceHeaderWriteFromDraft(parsed.data, {
        assignedStaffUserId,
        status: "DRAFT",
        complianceStatus: existing.complianceStatus,
      }),
      // Preserve existing number if any; numbering assignment is TASK-035.
      invoiceNumber: existing.invoiceNumber,
    };

    const updated = await deps.store.updateInvoice(parsedId.data, writeInput, {
      updatedByUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: updated.companyId,
        entityType: AuditEntityTypes.INVOICE,
        entityId: updated.id,
        action: AuditActions.INVOICE_UPDATED,
        oldValues: invoiceAuditSnapshot(existing),
        newValues: invoiceAuditSnapshot(updated),
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "invoices.updated",
        actorUserId: actor.userId,
        invoiceId: updated.id,
        companyId: updated.companyId,
      },
      "Draft invoice updated",
    );

    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

function toAuthzOrUnavailable(error: unknown): {
  ok: false;
  status: 400 | 403 | 503;
  error: string;
} {
  if (error instanceof CustomerDomainError) {
    return { ok: false, status: 400, error: error.message };
  }
  if (error instanceof AuthorizationError) {
    return { ok: false, status: 403, error: error.message };
  }
  if (error && typeof error === "object" && "status" in error && "message" in error) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return {
        ok: false,
        status: 403,
        error:
          typeof error.message === "string"
            ? error.message
            : "You do not have permission to perform this action.",
      };
    }
  }

  logger.error(
    { event: "invoices.unavailable", err: error instanceof Error ? error.message : "unknown" },
    "Invoice draft management failed",
  );
  return { ok: false, status: 503, error: INVOICE_UNAVAILABLE };
}
