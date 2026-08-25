import "server-only";

import { logger } from "@/lib/logger";
import { AuditActions, AuditEntityTypes } from "@/domain/audit/types";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import { AuthorizationError } from "@/domain/authz/errors";
import { canAccessCustomer } from "@/domain/customers/access";
import { complianceStatusUpdateSchema } from "@/domain/compliance/schema";
import {
  COMPLIANCE_COMPANY_REQUIRED,
  COMPLIANCE_INVALID_INPUT,
  COMPLIANCE_NOT_FOUND,
  COMPLIANCE_STATUS_FORBIDDEN,
  COMPLIANCE_UNAVAILABLE,
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

export interface ComplianceServiceDependencies {
  readonly store: Pick<
    PrismaComplianceStore,
    | "createReview"
    | "updateInvoiceComplianceStatus"
    | "updatePaymentComplianceStatus"
    | "updateCustomerComplianceStatus"
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

/**
 * Set compliance status on invoice, payment, or customer (TASK-071).
 * Requires compliance.review (Admin/Compliance). Staff receives 403.
 * Creates a compliance_reviews row; notes/reason codes are TASK-073.
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

    const { subjectType, subjectId, status } = parsed.data;
    let companyId: string;
    let previousStatus: ComplianceStatus;

    if (subjectType === "INVOICE") {
      const invoice = await deps.invoices.getInvoiceById(subjectId);
      if (!invoice) {
        return { ok: false, status: 404, error: COMPLIANCE_NOT_FOUND };
      }
      assertCompanyAccess(actor, invoice.companyId);
      if (!canViewInvoice(actor, invoice)) {
        throw new AuthorizationError("denied");
      }
      companyId = invoice.companyId;
      previousStatus = invoice.complianceStatus;
    } else if (subjectType === "PAYMENT") {
      const payment = await deps.payments.getPaymentById(subjectId);
      if (!payment) {
        return { ok: false, status: 404, error: COMPLIANCE_NOT_FOUND };
      }
      assertCompanyAccess(actor, payment.companyId);
      const invoice = await deps.invoices.getInvoiceById(payment.invoiceId);
      if (!invoice || !canViewPayment(actor, payment, invoice)) {
        throw new AuthorizationError("denied");
      }
      companyId = payment.companyId;
      previousStatus = payment.complianceStatus;
    } else {
      const customer = await deps.customers.getCustomerById(subjectId);
      if (!customer || !canAccessCustomer(actor, customer)) {
        return { ok: false, status: 404, error: COMPLIANCE_NOT_FOUND };
      }
      const requestedCompanyId = parsed.data.companyId;
      if (!requestedCompanyId) {
        return { ok: false, status: 400, error: COMPLIANCE_COMPANY_REQUIRED };
      }
      if (!customer.companyIds.includes(requestedCompanyId)) {
        return { ok: false, status: 400, error: COMPLIANCE_INVALID_INPUT };
      }
      assertCompanyAccess(actor, requestedCompanyId);
      companyId = requestedCompanyId;
      previousStatus = customer.complianceStatus;
    }

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
        newValues: { complianceStatus: status, reviewId: review.id },
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
