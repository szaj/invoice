import "server-only";

import { logger } from "@/lib/logger";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  assertCompanyAccess,
  assignedCompanyIdsOf,
  companyScopeForRole,
} from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { canAccessCustomer } from "@/domain/customers/access";
import {
  complianceNoteCreateSchema,
  complianceNotesQuerySchema,
  complianceQueueQuerySchema,
  complianceStatusUpdateSchema,
} from "@/domain/compliance/schema";
import { buildComplianceExportCsv, complianceExportFilename } from "@/domain/compliance/export-csv";
import {
  COMPLIANCE_COMPANY_REQUIRED,
  COMPLIANCE_EXPORT_FORBIDDEN,
  COMPLIANCE_INVALID_INPUT,
  COMPLIANCE_NOTE_REQUIRED,
  COMPLIANCE_NOT_FOUND,
  COMPLIANCE_NOTES_FORBIDDEN,
  COMPLIANCE_QUEUE_FORBIDDEN,
  COMPLIANCE_STATUS_FORBIDDEN,
  COMPLIANCE_UNAVAILABLE,
  type ComplianceQueueItem,
  type ComplianceReviewRecord,
  type ComplianceStatus,
} from "@/domain/compliance/types";
import { canViewInvoice } from "@/domain/invoices/access";
import { canViewPayment } from "@/domain/payments/access";
import {
  getAuditWriter,
  recordAuditEventRequired,
  type AuditWriter,
} from "@/server/audit/audit-service";
import { assertTransactionalCompanyRequest } from "@/server/company-context/transactional";
import { PrismaComplianceStore } from "@/server/compliance/compliance-repository";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";

export type ComplianceServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 401 | 403 | 404 | 503; error: string };

export type UpdateComplianceStatusResult = {
  readonly subjectType: "INVOICE" | "PAYMENT" | "CUSTOMER";
  readonly subjectId: string;
  readonly companyId: string;
  readonly previousStatus: ComplianceStatus;
  readonly status: ComplianceStatus;
  readonly review: ComplianceReviewRecord | null;
};

export type AddComplianceNoteResult = {
  readonly subjectType: "INVOICE" | "PAYMENT" | "CUSTOMER";
  readonly subjectId: string;
  readonly companyId: string;
  readonly status: ComplianceStatus;
  readonly review: ComplianceReviewRecord;
};

export type ComplianceExportResult = {
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly contentType: "text/csv; charset=utf-8";
  readonly rowCount: number;
};

type ResolvedComplianceSubject = {
  readonly companyId: string;
  readonly previousStatus: ComplianceStatus;
};

export interface ComplianceServiceDependencies {
  readonly store: Pick<
    PrismaComplianceStore,
    | "createReview"
    | "listReviews"
    | "updateInvoiceComplianceStatus"
    | "updatePaymentComplianceStatus"
    | "updateCustomerComplianceStatus"
    | "listQueue"
  >;
  readonly invoices: Pick<PrismaInvoiceStore, "getInvoiceById">;
  readonly payments: Pick<PrismaPaymentStore, "getPaymentById">;
  readonly customers: Pick<PrismaCustomerStore, "getCustomerById">;
  readonly auditWriter?: AuditWriter;
  readonly enforceTransactionalCompanyScope?: (
    actor: AuthorizationPrincipal,
    companyId: string,
  ) => Promise<ComplianceServiceResult<true>>;
}

export function createDefaultComplianceServiceDependencies(): ComplianceServiceDependencies {
  return {
    store: new PrismaComplianceStore(),
    invoices: new PrismaInvoiceStore(),
    payments: new PrismaPaymentStore(),
    customers: new PrismaCustomerStore(),
  };
}

function auditWriterOf(deps: ComplianceServiceDependencies): AuditWriter {
  return deps.auditWriter ?? getAuditWriter();
}

async function enforceTransactionalCompanyScopeOf(
  actor: AuthorizationPrincipal,
  companyId: string,
  deps: ComplianceServiceDependencies,
): Promise<ComplianceServiceResult<true>> {
  if (deps.enforceTransactionalCompanyScope) {
    return deps.enforceTransactionalCompanyScope(actor, companyId);
  }
  const scope = await assertTransactionalCompanyRequest(actor, companyId);
  if (!scope.ok) {
    return { ok: false, status: scope.status, error: scope.error };
  }
  return { ok: true, data: true };
}

function subjectEntityType(
  subjectType: "INVOICE" | "PAYMENT" | "CUSTOMER",
): (typeof AuditEntityTypes)[keyof typeof AuditEntityTypes] {
  if (subjectType === "INVOICE") {
    return AuditEntityTypes.INVOICE;
  }
  if (subjectType === "PAYMENT") {
    return AuditEntityTypes.PAYMENT;
  }
  return AuditEntityTypes.CUSTOMER;
}

function normalizeEvidenceRefs(
  value: readonly string[] | null | undefined,
): readonly string[] | null {
  if (!value || value.length === 0) {
    return null;
  }
  return value;
}

function resolveQueueCompanyScope(
  actor: AuthorizationPrincipal,
  companyId: string | undefined,
): readonly string[] | "ALL" {
  if (companyId) {
    assertCompanyAccess(actor, companyId);
    return [companyId];
  }
  if (companyScopeForRole(actor.roleCode) === "ALL") {
    return "ALL";
  }
  return [...assignedCompanyIdsOf(actor)];
}

async function resolveSubjectAccess(
  actor: AuthorizationPrincipal,
  subjectType: "INVOICE" | "PAYMENT" | "CUSTOMER",
  subjectId: string,
  companyIdInput: string | null | undefined,
  deps: ComplianceServiceDependencies,
): Promise<ComplianceServiceResult<ResolvedComplianceSubject>> {
  if (subjectType === "INVOICE") {
    const invoice = await deps.invoices.getInvoiceById(subjectId);
    if (!invoice) {
      return { ok: false, status: 404, error: COMPLIANCE_NOT_FOUND };
    }
    assertCompanyAccess(actor, invoice.companyId);
    if (!canViewInvoice(actor, invoice)) {
      throw new AuthorizationError("denied");
    }
    return {
      ok: true,
      data: { companyId: invoice.companyId, previousStatus: invoice.complianceStatus },
    };
  }

  if (subjectType === "PAYMENT") {
    const payment = await deps.payments.getPaymentById(subjectId);
    if (!payment) {
      return { ok: false, status: 404, error: COMPLIANCE_NOT_FOUND };
    }
    assertCompanyAccess(actor, payment.companyId);
    const invoice = await deps.invoices.getInvoiceById(payment.invoiceId);
    if (!invoice || !canViewPayment(actor, payment, invoice)) {
      throw new AuthorizationError("denied");
    }
    return {
      ok: true,
      data: { companyId: payment.companyId, previousStatus: payment.complianceStatus },
    };
  }

  const customer = await deps.customers.getCustomerById(subjectId);
  if (!customer || !canAccessCustomer(actor, customer)) {
    return { ok: false, status: 404, error: COMPLIANCE_NOT_FOUND };
  }
  if (!companyIdInput) {
    return { ok: false, status: 400, error: COMPLIANCE_COMPANY_REQUIRED };
  }
  if (!customer.companyIds.includes(companyIdInput)) {
    return { ok: false, status: 400, error: COMPLIANCE_INVALID_INPUT };
  }
  assertCompanyAccess(actor, companyIdInput);
  return {
    ok: true,
    data: { companyId: companyIdInput, previousStatus: customer.complianceStatus },
  };
}

/**
 * Compliance review queue for assigned companies (TASK-072).
 * Filters: company, staff, date, amount, gateway, currency, status.
 * Requires compliance.review (Admin/Compliance). Staff receives 403.
 * Compliance cannot see unassigned company items; Admin may see all.
 */
export async function listComplianceQueue(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: ComplianceServiceDependencies = createDefaultComplianceServiceDependencies(),
): Promise<ComplianceServiceResult<ComplianceQueueItem[]>> {
  try {
    assertPermission(actor, "compliance.review");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = complianceQueueQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: COMPLIANCE_INVALID_INPUT };
    }

    const companyIds = resolveQueueCompanyScope(actor, parsed.data.companyId);
    if (companyIds !== "ALL" && companyIds.length === 0) {
      return { ok: true, data: [] };
    }

    const items = await deps.store.listQueue({
      ...parsed.data,
      companyIds,
    });

    return { ok: true, data: items };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: COMPLIANCE_QUEUE_FORBIDDEN };
    }
    logger.error(
      {
        event: "compliance.queue_list_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Compliance queue list failed",
    );
    return { ok: false, status: 503, error: COMPLIANCE_UNAVAILABLE };
  }
}

/**
 * Set compliance status on invoice, payment, or customer (TASK-071 / TASK-073).
 * Accepts optional notes, reason codes, resolution notes, and evidence refs.
 * Requires compliance.review (Admin/Compliance). Staff receives 403.
 * Creates a compliance_reviews row when status changes.
 */
export async function updateComplianceStatus(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: ComplianceServiceDependencies = createDefaultComplianceServiceDependencies(),
): Promise<ComplianceServiceResult<UpdateComplianceStatusResult>> {
  try {
    assertPermission(actor, "compliance.review");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = complianceStatusUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: COMPLIANCE_INVALID_INPUT };
    }

    const {
      subjectType,
      subjectId,
      status,
      notes,
      reason,
      resolutionNotes,
      evidenceRefs: rawEvidenceRefs,
    } = parsed.data;
    const evidenceRefs = normalizeEvidenceRefs(rawEvidenceRefs ?? null);

    const resolved = await resolveSubjectAccess(
      actor,
      subjectType,
      subjectId,
      parsed.data.companyId,
      deps,
    );
    if (!resolved.ok) {
      return resolved;
    }
    const { companyId, previousStatus } = resolved.data;

    const scope = await enforceTransactionalCompanyScopeOf(actor, companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    if (previousStatus === status) {
      return {
        ok: true,
        data: {
          subjectType,
          subjectId,
          companyId,
          previousStatus,
          status,
          review: null,
        },
      };
    }

    if (subjectType === "INVOICE") {
      await deps.store.updateInvoiceComplianceStatus(subjectId, status, {
        updatedByUserId: actor.userId,
      });
    } else if (subjectType === "PAYMENT") {
      await deps.store.updatePaymentComplianceStatus(subjectId, status);
    } else {
      await deps.store.updateCustomerComplianceStatus(subjectId, status, {
        updatedByUserId: actor.userId,
      });
    }

    const review = await deps.store.createReview({
      companyId,
      subjectType,
      subjectId,
      status,
      notes: notes ?? null,
      reason: reason ?? null,
      resolutionNotes: resolutionNotes ?? null,
      evidenceRefs,
      reviewerUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId,
        entityType: subjectEntityType(subjectType),
        entityId: subjectId,
        action: AuditActions.COMPLIANCE_STATUS_UPDATED,
        oldValues: { complianceStatus: previousStatus },
        newValues: {
          complianceStatus: status,
          reviewId: review.id,
          notes: review.notes,
          reason: review.reason,
          resolutionNotes: review.resolutionNotes,
          evidenceRefs: review.evidenceRefs ? [...review.evidenceRefs] : null,
        },
        reason: review.reason,
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "compliance.status_updated",
        actorUserId: actor.userId,
        subjectType,
        subjectId,
        companyId,
        previousStatus,
        status,
        reviewId: review.id,
      },
      "Compliance status updated",
    );

    return {
      ok: true,
      data: {
        subjectType,
        subjectId,
        companyId,
        previousStatus,
        status,
        review,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: COMPLIANCE_STATUS_FORBIDDEN };
    }
    logger.error(
      {
        event: "compliance.status_update_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Compliance status update failed",
    );
    return { ok: false, status: 503, error: COMPLIANCE_UNAVAILABLE };
  }
}

/**
 * Add internal compliance notes / reason / resolution without changing status (TASK-073).
 * Requires compliance.review. Staff receives 403. Writes compliance.note_added audit.
 */
export async function addComplianceNote(
  actor: AuthorizationPrincipal | null,
  input: unknown,
  deps: ComplianceServiceDependencies = createDefaultComplianceServiceDependencies(),
): Promise<ComplianceServiceResult<AddComplianceNoteResult>> {
  try {
    assertPermission(actor, "compliance.review");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = complianceNoteCreateSchema.safeParse(input);
    if (!parsed.success) {
      const noteRequired = parsed.error.issues.some(
        (issue) => issue.message === COMPLIANCE_NOTE_REQUIRED,
      );
      return {
        ok: false,
        status: 400,
        error: noteRequired ? COMPLIANCE_NOTE_REQUIRED : COMPLIANCE_INVALID_INPUT,
      };
    }

    const { subjectType, subjectId, notes, reason, resolutionNotes } = parsed.data;
    const evidenceRefs = normalizeEvidenceRefs(parsed.data.evidenceRefs ?? null);

    const resolved = await resolveSubjectAccess(
      actor,
      subjectType,
      subjectId,
      parsed.data.companyId,
      deps,
    );
    if (!resolved.ok) {
      return resolved;
    }
    const { companyId, previousStatus } = resolved.data;

    const scope = await enforceTransactionalCompanyScopeOf(actor, companyId, deps);
    if (!scope.ok) {
      return scope;
    }

    const review = await deps.store.createReview({
      companyId,
      subjectType,
      subjectId,
      status: previousStatus,
      notes: notes ?? null,
      reason: reason ?? null,
      resolutionNotes: resolutionNotes ?? null,
      evidenceRefs,
      reviewerUserId: actor.userId,
    });

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId,
        entityType: AuditEntityTypes.COMPLIANCE_REVIEW,
        entityId: review.id,
        action: AuditActions.COMPLIANCE_NOTE_ADDED,
        oldValues: null,
        newValues: {
          subjectType,
          subjectId,
          complianceStatus: previousStatus,
          notes: review.notes,
          reason: review.reason,
          resolutionNotes: review.resolutionNotes,
          evidenceRefs: review.evidenceRefs ? [...review.evidenceRefs] : null,
        },
        reason: review.reason,
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "compliance.note_added",
        actorUserId: actor.userId,
        subjectType,
        subjectId,
        companyId,
        reviewId: review.id,
      },
      "Compliance note added",
    );

    return {
      ok: true,
      data: {
        subjectType,
        subjectId,
        companyId,
        status: previousStatus,
        review,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: COMPLIANCE_NOTES_FORBIDDEN };
    }
    logger.error(
      {
        event: "compliance.note_add_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Compliance note add failed",
    );
    return { ok: false, status: 503, error: COMPLIANCE_UNAVAILABLE };
  }
}

/**
 * Export filtered compliance queue as CSV (TASK-075).
 * Requires report.export and compliance.review (Admin/Compliance).
 * Staff is denied by default (US-009). Export is audited (BR-015).
 */
export async function exportComplianceReport(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: ComplianceServiceDependencies = createDefaultComplianceServiceDependencies(),
): Promise<ComplianceServiceResult<ComplianceExportResult>> {
  try {
    assertPermission(actor, "report.export");
    assertPermission(actor, "compliance.review");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = complianceQueueQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: COMPLIANCE_INVALID_INPUT };
    }

    const companyIds = resolveQueueCompanyScope(actor, parsed.data.companyId);
    const items =
      companyIds !== "ALL" && companyIds.length === 0
        ? []
        : await deps.store.listQueue({
            ...parsed.data,
            companyIds,
          });

    const csv = buildComplianceExportCsv(items);
    const filename = complianceExportFilename();
    const bytes = new TextEncoder().encode(csv);

    await recordAuditEventRequired(
      {
        actorType: "USER",
        actorUserId: actor.userId,
        companyId: parsed.data.companyId ?? null,
        entityType: AuditEntityTypes.COMPLIANCE_EXPORT,
        entityId: null,
        action: AuditActions.COMPLIANCE_EXPORTED,
        oldValues: null,
        newValues: {
          format: "csv",
          rowCount: items.length,
          filters: serializeExportFilters(parsed.data),
        },
      },
      auditWriterOf(deps),
    );

    logger.info(
      {
        event: "compliance.exported",
        actorUserId: actor.userId,
        rowCount: items.length,
        companyId: parsed.data.companyId ?? null,
      },
      "Compliance report exported",
    );

    return {
      ok: true,
      data: {
        bytes,
        filename,
        contentType: "text/csv; charset=utf-8",
        rowCount: items.length,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: COMPLIANCE_EXPORT_FORBIDDEN };
    }
    logger.error(
      {
        event: "compliance.export_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Compliance export failed",
    );
    return { ok: false, status: 503, error: COMPLIANCE_UNAVAILABLE };
  }
}

function serializeExportFilters(filters: {
  readonly companyId?: string;
  readonly staffUserId?: string;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly amountMin?: string;
  readonly amountMax?: string;
  readonly gateway?: string;
  readonly currency?: string;
  readonly status?: string;
  readonly subjectType?: string;
}): {
  readonly companyId: string | null;
  readonly staffUserId: string | null;
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  readonly amountMin: string | null;
  readonly amountMax: string | null;
  readonly gateway: string | null;
  readonly currency: string | null;
  readonly status: string | null;
  readonly subjectType: string | null;
} {
  return {
    companyId: filters.companyId ?? null,
    staffUserId: filters.staffUserId ?? null,
    dateFrom: filters.dateFrom ? filters.dateFrom.toISOString().slice(0, 10) : null,
    dateTo: filters.dateTo ? filters.dateTo.toISOString().slice(0, 10) : null,
    amountMin: filters.amountMin ?? null,
    amountMax: filters.amountMax ?? null,
    gateway: filters.gateway ?? null,
    currency: filters.currency ?? null,
    status: filters.status ?? null,
    subjectType: filters.subjectType ?? null,
  };
}

/**
 * List compliance review notes for a subject (TASK-073).
 * Requires compliance.review. Staff receives 403.
 */
export async function listComplianceNotes(
  actor: AuthorizationPrincipal | null,
  query: unknown = {},
  deps: ComplianceServiceDependencies = createDefaultComplianceServiceDependencies(),
): Promise<ComplianceServiceResult<ComplianceReviewRecord[]>> {
  try {
    assertPermission(actor, "compliance.review");
    if (!actor) {
      throw new AuthorizationError("unauthenticated");
    }

    const parsed = complianceNotesQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return { ok: false, status: 400, error: COMPLIANCE_INVALID_INPUT };
    }

    const { subjectType, subjectId } = parsed.data;
    const resolved = await resolveSubjectAccess(
      actor,
      subjectType,
      subjectId,
      parsed.data.companyId,
      deps,
    );
    if (!resolved.ok) {
      return resolved;
    }

    const reviews = await deps.store.listReviews({
      subjectType,
      subjectId,
      companyId: resolved.data.companyId,
    });

    return { ok: true, data: reviews };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, status: 403, error: COMPLIANCE_NOTES_FORBIDDEN };
    }
    logger.error(
      {
        event: "compliance.notes_list_failed",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Compliance notes list failed",
    );
    return { ok: false, status: 503, error: COMPLIANCE_UNAVAILABLE };
  }
}
