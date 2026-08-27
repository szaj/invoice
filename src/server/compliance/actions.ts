"use server";

import { revalidatePath } from "next/cache";

import { authorizePermission } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { ComplianceQueueQuery } from "@/domain/compliance/schema";
import {
  COMPLIANCE_NOTES_FORBIDDEN,
  COMPLIANCE_NOT_FOUND,
  COMPLIANCE_QUEUE_FORBIDDEN,
  COMPLIANCE_STATUS_FORBIDDEN,
  type ComplianceQueueItem,
  type ComplianceReviewRecord,
  type ComplianceReviewSubjectType,
  type ComplianceStatus,
} from "@/domain/compliance/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { listSwitcherCompanies } from "@/server/company-context/accessible-companies";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";
import {
  addComplianceNote,
  listComplianceNotes,
  listComplianceQueue,
  updateComplianceStatus,
} from "@/server/compliance/compliance-service";
import { PrismaCustomerStore } from "@/server/customers/customer-repository";
import { PrismaInvoiceStore } from "@/server/invoices/invoice-repository";
import { PrismaPaymentStore } from "@/server/payments/payment-repository";

export type ComplianceQueueRow = {
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly companyId: string;
  readonly companyDisplayName: string;
  readonly complianceStatus: ComplianceStatus;
  readonly staffUserId: string | null;
  readonly date: string | null;
  readonly amount: string | null;
  readonly currencyCode: string | null;
  readonly gateway: string | null;
  readonly label: string | null;
  readonly customerId: string | null;
  readonly invoiceId: string | null;
  readonly href: string;
};

export type ComplianceReviewNoteView = {
  readonly id: string;
  readonly status: ComplianceStatus;
  readonly notes: string | null;
  readonly reason: string | null;
  readonly resolutionNotes: string | null;
  readonly evidenceRefs: readonly string[] | null;
  readonly reviewerUserId: string | null;
  readonly createdAt: string;
};

export type ComplianceSubjectSummary = {
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly companyId: string;
  readonly companyDisplayName: string;
  readonly complianceStatus: ComplianceStatus;
  readonly label: string;
  readonly recordHref: string;
  readonly staffUserId: string | null;
  readonly amount: string | null;
  readonly currencyCode: string | null;
  readonly gateway: string | null;
  readonly date: string | null;
};

export type ComplianceUiActionResult =
  { ok: true; message?: string } | { ok: false; error: string; status?: number };

function toIsoDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString().slice(0, 10);
}

function toIsoDateTime(value: Date): string {
  return value.toISOString();
}

function reviewHref(
  subjectType: ComplianceReviewSubjectType,
  subjectId: string,
  companyId: string,
): string {
  const base = `/compliance/${subjectType.toLowerCase()}/${subjectId}`;
  if (subjectType === "CUSTOMER") {
    return `${base}?companyId=${encodeURIComponent(companyId)}`;
  }
  return base;
}

function recordHref(subjectType: ComplianceReviewSubjectType, subjectId: string): string {
  if (subjectType === "INVOICE") {
    return `/invoices/${subjectId}`;
  }
  if (subjectType === "PAYMENT") {
    return `/payments/${subjectId}`;
  }
  return `/customers/${subjectId}`;
}

function mapQueueItem(
  item: ComplianceQueueItem,
  companyNameById: Map<string, string>,
): ComplianceQueueRow {
  return {
    subjectType: item.subjectType,
    subjectId: item.subjectId,
    companyId: item.companyId,
    companyDisplayName: companyNameById.get(item.companyId) ?? item.companyId.slice(0, 8),
    complianceStatus: item.complianceStatus,
    staffUserId: item.staffUserId,
    date: toIsoDate(item.date),
    amount: item.amount,
    currencyCode: item.currencyCode,
    gateway: item.gateway,
    label: item.label,
    customerId: item.customerId,
    invoiceId: item.invoiceId,
    href: reviewHref(item.subjectType, item.subjectId, item.companyId),
  };
}

function mapReviewNote(review: ComplianceReviewRecord): ComplianceReviewNoteView {
  return {
    id: review.id,
    status: review.status,
    notes: review.notes,
    reason: review.reason,
    resolutionNotes: review.resolutionNotes,
    evidenceRefs: review.evidenceRefs,
    reviewerUserId: review.reviewerUserId,
    createdAt: toIsoDateTime(review.createdAt),
  };
}

/**
 * Company options for the compliance queue filters (TASK-074).
 * Requires compliance.review. Staff is denied.
 */
export async function loadComplianceQueueOptions(companyId?: string | null) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "compliance.review").allowed) {
    return {
      ok: false as const,
      status: 403 as const,
      error: COMPLIANCE_QUEUE_FORBIDDEN,
      companies: [] as Array<{ id: string; displayName: string }>,
      defaultCompanyId: null as string | null,
    };
  }

  const companies = await listSwitcherCompanies(actor);
  const context = await loadCompanyContextForLayout();
  const contextCompanyId =
    context.selection?.kind === "company" ? context.selection.companyId : null;
  const selectedCompanyId =
    companyId && companies.some((company) => company.id === companyId)
      ? companyId
      : contextCompanyId && companies.some((company) => company.id === contextCompanyId)
        ? contextCompanyId
        : companies.length === 1
          ? (companies[0]?.id ?? null)
          : null;

  return {
    ok: true as const,
    companies: companies.map((company) => ({
      id: company.id,
      displayName: company.displayName,
    })),
    defaultCompanyId: selectedCompanyId,
  };
}

/**
 * Compliance review queue for UI (TASK-074).
 * Delegates to listComplianceQueue — Staff denied; unassigned companies excluded.
 */
export async function loadComplianceQueueForUi(
  query: ComplianceQueueQuery,
): Promise<
  | { ok: true; data: ComplianceQueueRow[]; status?: undefined; error?: undefined }
  | { ok: false; error: string; status: number; data?: undefined }
> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "compliance.review").allowed) {
    return { ok: false, status: 403, error: COMPLIANCE_QUEUE_FORBIDDEN };
  }

  const result = await listComplianceQueue(actor, query);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }

  const companies = await listSwitcherCompanies(actor);
  const companyNameById = new Map(companies.map((company) => [company.id, company.displayName]));

  return {
    ok: true,
    data: result.data.map((item) => mapQueueItem(item, companyNameById)),
  };
}

/**
 * Load compliance review detail for a subject (TASK-074).
 * Requires compliance.review. Staff and unassigned company subjects are denied.
 */
export async function loadComplianceReviewForUi(input: {
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly companyId?: string | null;
}): Promise<
  | {
      ok: true;
      data: {
        subject: ComplianceSubjectSummary;
        notes: readonly ComplianceReviewNoteView[];
        canReview: true;
      };
    }
  | { ok: false; error: string; status: number }
> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "compliance.review").allowed) {
    return { ok: false, status: 403, error: COMPLIANCE_NOTES_FORBIDDEN };
  }

  const notesResult = await listComplianceNotes(actor, {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    companyId: input.companyId ?? null,
  });
  if (!notesResult.ok) {
    return { ok: false, status: notesResult.status, error: notesResult.error };
  }

  const companies = await listSwitcherCompanies(actor);
  const companyNameById = new Map(companies.map((company) => [company.id, company.displayName]));

  const subject = await loadSubjectSummary(
    input.subjectType,
    input.subjectId,
    input.companyId ?? null,
    companyNameById,
  );
  if (!subject) {
    return { ok: false, status: 404, error: COMPLIANCE_NOT_FOUND };
  }

  // Re-check company appears in actor-visible set (Admin: all; Compliance: assigned).
  if (
    actor?.roleCode !== "ADMIN" &&
    !companies.some((company) => company.id === subject.companyId)
  ) {
    return { ok: false, status: 403, error: GENERIC_FORBIDDEN };
  }

  return {
    ok: true,
    data: {
      subject,
      notes: notesResult.data.map(mapReviewNote),
      canReview: true,
    },
  };
}

async function loadSubjectSummary(
  subjectType: ComplianceReviewSubjectType,
  subjectId: string,
  companyIdInput: string | null,
  companyNameById: Map<string, string>,
): Promise<ComplianceSubjectSummary | null> {
  if (subjectType === "INVOICE") {
    const invoice = await new PrismaInvoiceStore().getInvoiceById(subjectId);
    if (!invoice) {
      return null;
    }
    return {
      subjectType,
      subjectId,
      companyId: invoice.companyId,
      companyDisplayName: companyNameById.get(invoice.companyId) ?? invoice.companyId.slice(0, 8),
      complianceStatus: invoice.complianceStatus,
      label: invoice.invoiceNumber ?? `Invoice ${invoice.id.slice(0, 8)}`,
      recordHref: recordHref(subjectType, subjectId),
      staffUserId: invoice.assignedStaffUserId,
      amount: invoice.invoiceTotal,
      currencyCode: invoice.currencyCode,
      gateway: null,
      date: toIsoDate(invoice.invoiceDate),
    };
  }

  if (subjectType === "PAYMENT") {
    const payment = await new PrismaPaymentStore().getPaymentById(subjectId);
    if (!payment) {
      return null;
    }
    return {
      subjectType,
      subjectId,
      companyId: payment.companyId,
      companyDisplayName: companyNameById.get(payment.companyId) ?? payment.companyId.slice(0, 8),
      complianceStatus: payment.complianceStatus,
      label: payment.externalTransactionId ?? `Payment ${payment.id.slice(0, 8)}`,
      recordHref: recordHref(subjectType, subjectId),
      staffUserId: null,
      amount: payment.invoiceAmountApplied,
      currencyCode: payment.invoiceCurrencyCode,
      gateway: payment.methodCode,
      date: toIsoDate(payment.paymentDate),
    };
  }

  const customer = await new PrismaCustomerStore().getCustomerById(subjectId);
  if (!customer) {
    return null;
  }
  const companyId = companyIdInput ?? customer.companyIds[0] ?? null;
  if (!companyId) {
    return null;
  }
  return {
    subjectType,
    subjectId,
    companyId,
    companyDisplayName: companyNameById.get(companyId) ?? companyId.slice(0, 8),
    complianceStatus: customer.complianceStatus,
    label: customer.displayName,
    recordHref: recordHref(subjectType, subjectId),
    staffUserId: customer.assignedStaffUserId,
    amount: null,
    currencyCode: customer.defaultInvoiceCurrencyCode,
    gateway: null,
    date: toIsoDate(customer.createdAt),
  };
}

function revalidateCompliancePaths(
  subjectType: ComplianceReviewSubjectType,
  subjectId: string,
  companyId: string,
) {
  revalidatePath("/compliance");
  revalidatePath(reviewHref(subjectType, subjectId, companyId));
  revalidatePath(recordHref(subjectType, subjectId));
}

/**
 * Set compliance status from the review UI (TASK-074).
 * Staff is denied server-side via compliance.review.
 */
export async function updateComplianceStatusAction(input: {
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly companyId?: string | null;
  readonly status: ComplianceStatus;
  readonly notes?: string | null;
  readonly reason?: string | null;
  readonly resolutionNotes?: string | null;
}): Promise<ComplianceUiActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "compliance.review").allowed) {
    return { ok: false, status: 403, error: COMPLIANCE_STATUS_FORBIDDEN };
  }

  const result = await updateComplianceStatus(actor, {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    companyId: input.companyId ?? null,
    status: input.status,
    notes: input.notes ?? null,
    reason: input.reason ?? null,
    resolutionNotes: input.resolutionNotes ?? null,
  });
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }

  revalidateCompliancePaths(result.data.subjectType, result.data.subjectId, result.data.companyId);
  return {
    ok: true,
    message: `Status set to ${result.data.status.replaceAll("_", " ").toLowerCase()}.`,
  };
}

/**
 * Add compliance notes without changing status (TASK-074).
 * Staff is denied server-side via compliance.review.
 */
export async function addComplianceNoteAction(input: {
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly companyId?: string | null;
  readonly notes?: string | null;
  readonly reason?: string | null;
  readonly resolutionNotes?: string | null;
}): Promise<ComplianceUiActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "compliance.review").allowed) {
    return { ok: false, status: 403, error: COMPLIANCE_NOTES_FORBIDDEN };
  }

  const result = await addComplianceNote(actor, {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    companyId: input.companyId ?? null,
    notes: input.notes ?? null,
    reason: input.reason ?? null,
    resolutionNotes: input.resolutionNotes ?? null,
  });
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }

  revalidateCompliancePaths(result.data.subjectType, result.data.subjectId, result.data.companyId);
  return { ok: true, message: "Compliance note added." };
}
