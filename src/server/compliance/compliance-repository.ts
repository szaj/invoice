import "server-only";

import { Prisma } from "@/generated/prisma/client";

import type { ComplianceQueueQuery } from "@/domain/compliance/schema";
import type {
  ComplianceStatus,
  ComplianceQueueItem,
  ComplianceReviewRecord,
  ComplianceReviewSubjectType,
} from "@/domain/compliance/types";
import { getPrisma } from "@/server/db/client";

type ComplianceReviewRow = {
  id: string;
  companyId: string;
  subjectType: ComplianceReviewSubjectType;
  subjectId: string;
  status: ComplianceStatus;
  notes: string | null;
  reason: string | null;
  resolutionNotes: string | null;
  evidenceRefs: Prisma.JsonValue | null;
  reviewerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapEvidenceRefs(value: Prisma.JsonValue | null): readonly string[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const refs = value.filter((item): item is string => typeof item === "string");
  return refs.length > 0 ? refs : null;
}

function mapReview(row: ComplianceReviewRow): ComplianceReviewRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    status: row.status,
    notes: row.notes,
    reason: row.reason,
    resolutionNotes: row.resolutionNotes,
    evidenceRefs: mapEvidenceRefs(row.evidenceRefs),
    reviewerUserId: row.reviewerUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function decimalString(value: Prisma.Decimal | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "string" ? value : value.toFixed();
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

export type ComplianceReviewCreateInput = {
  readonly companyId: string;
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly status: ComplianceStatus;
  readonly notes?: string | null;
  readonly reason?: string | null;
  readonly resolutionNotes?: string | null;
  readonly evidenceRefs?: readonly string[] | null;
  readonly reviewerUserId: string | null;
};

export type ComplianceQueueListInput = ComplianceQueueQuery & {
  /** Concrete company IDs, or "ALL" for Admin unscoped queue. */
  readonly companyIds: readonly string[] | "ALL";
};

export type ComplianceReviewsListInput = {
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly companyId?: string;
};

/**
 * Persistence for compliance_reviews, subject status columns (TASK-071),
 * compliance review queue queries (TASK-072), and notes/reason codes (TASK-073).
 */
export class PrismaComplianceStore {
  async createReview(input: ComplianceReviewCreateInput): Promise<ComplianceReviewRecord> {
    const prisma = getPrisma();
    const evidenceRefs =
      input.evidenceRefs && input.evidenceRefs.length > 0
        ? ([...input.evidenceRefs] as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    const row = await prisma.complianceReview.create({
      data: {
        companyId: input.companyId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        status: input.status,
        notes: input.notes ?? null,
        reason: input.reason ?? null,
        resolutionNotes: input.resolutionNotes ?? null,
        evidenceRefs,
        reviewerUserId: input.reviewerUserId,
      },
    });
    return mapReview(row as ComplianceReviewRow);
  }

  async listReviews(input: ComplianceReviewsListInput): Promise<ComplianceReviewRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.complianceReview.findMany({
      where: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        ...(input.companyId ? { companyId: input.companyId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return rows.map((row) => mapReview(row as ComplianceReviewRow));
  }

  async updateInvoiceComplianceStatus(
    id: string,
    status: ComplianceStatus,
    actor?: { updatedByUserId?: string | null },
  ): Promise<void> {
    const prisma = getPrisma();
    await prisma.invoice.update({
      where: { id },
      data: {
        complianceStatus: status,
        updatedByUserId: actor?.updatedByUserId ?? undefined,
      },
    });
  }

  async updatePaymentComplianceStatus(id: string, status: ComplianceStatus): Promise<void> {
    const prisma = getPrisma();
    await prisma.payment.update({
      where: { id },
      data: { complianceStatus: status },
    });
  }

  async updateCustomerComplianceStatus(
    id: string,
    status: ComplianceStatus,
    actor?: { updatedByUserId?: string | null },
  ): Promise<void> {
    const prisma = getPrisma();
    await prisma.customer.update({
      where: { id },
      data: {
        complianceStatus: status,
        updatedByUserId: actor?.updatedByUserId ?? undefined,
      },
    });
  }

  /**
   * List invoice/payment/customer subjects for the compliance review queue.
   * Caller must already resolve companyIds to the actor's accessible set.
   */
  async listQueue(filters: ComplianceQueueListInput): Promise<ComplianceQueueItem[]> {
    if (filters.companyIds !== "ALL" && filters.companyIds.length === 0) {
      return [];
    }

    const includeInvoices =
      (!filters.subjectType || filters.subjectType === "INVOICE") && !filters.gateway;
    const includePayments = !filters.subjectType || filters.subjectType === "PAYMENT";
    const includeCustomers =
      (!filters.subjectType || filters.subjectType === "CUSTOMER") &&
      !filters.gateway &&
      filters.amountMin === undefined &&
      filters.amountMax === undefined;

    const [invoices, payments, customers] = await Promise.all([
      includeInvoices ? this.listInvoiceQueueItems(filters) : Promise.resolve([]),
      includePayments ? this.listPaymentQueueItems(filters) : Promise.resolve([]),
      includeCustomers ? this.listCustomerQueueItems(filters) : Promise.resolve([]),
    ]);

    return [...invoices, ...payments, ...customers].sort((a, b) => {
      const aTime = a.date?.getTime() ?? 0;
      const bTime = b.date?.getTime() ?? 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      if (a.subjectType !== b.subjectType) {
        return a.subjectType.localeCompare(b.subjectType);
      }
      return a.subjectId.localeCompare(b.subjectId);
    });
  }

  private companyWhere(companyIds: readonly string[] | "ALL"): { companyId?: { in: string[] } } {
    if (companyIds === "ALL") {
      return {};
    }
    return { companyId: { in: [...companyIds] } };
  }

  private async listInvoiceQueueItems(
    filters: ComplianceQueueListInput,
  ): Promise<ComplianceQueueItem[]> {
    const prisma = getPrisma();
    const dateFilter: Prisma.DateTimeFilter | undefined =
      filters.dateFrom || filters.dateTo
        ? {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: endOfUtcDay(filters.dateTo) } : {}),
          }
        : undefined;

    const amountFilter: Prisma.DecimalFilter | undefined =
      filters.amountMin !== undefined || filters.amountMax !== undefined
        ? {
            ...(filters.amountMin !== undefined ? { gte: filters.amountMin } : {}),
            ...(filters.amountMax !== undefined ? { lte: filters.amountMax } : {}),
          }
        : undefined;

    const rows = await prisma.invoice.findMany({
      where: {
        ...this.companyWhere(filters.companyIds),
        ...(filters.status ? { complianceStatus: filters.status } : {}),
        ...(filters.staffUserId ? { assignedStaffUserId: filters.staffUserId } : {}),
        ...(filters.currency ? { currencyCode: filters.currency } : {}),
        ...(dateFilter ? { invoiceDate: dateFilter } : {}),
        ...(amountFilter ? { invoiceTotal: amountFilter } : {}),
      },
      select: {
        id: true,
        companyId: true,
        customerId: true,
        invoiceNumber: true,
        invoiceDate: true,
        currencyCode: true,
        invoiceTotal: true,
        assignedStaffUserId: true,
        complianceStatus: true,
      },
      orderBy: [{ invoiceDate: "desc" }, { id: "asc" }],
    });

    return rows.map((row) => ({
      subjectType: "INVOICE" as const,
      subjectId: row.id,
      companyId: row.companyId,
      complianceStatus: row.complianceStatus as ComplianceStatus,
      staffUserId: row.assignedStaffUserId,
      date: row.invoiceDate,
      amount: decimalString(row.invoiceTotal),
      currencyCode: row.currencyCode,
      gateway: null,
      label: row.invoiceNumber,
      customerId: row.customerId,
      invoiceId: row.id,
    }));
  }

  private async listPaymentQueueItems(
    filters: ComplianceQueueListInput,
  ): Promise<ComplianceQueueItem[]> {
    const prisma = getPrisma();
    const dateFilter: Prisma.DateTimeFilter | undefined =
      filters.dateFrom || filters.dateTo
        ? {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: endOfUtcDay(filters.dateTo) } : {}),
          }
        : undefined;

    const amountFilter: Prisma.DecimalFilter | undefined =
      filters.amountMin !== undefined || filters.amountMax !== undefined
        ? {
            ...(filters.amountMin !== undefined ? { gte: filters.amountMin } : {}),
            ...(filters.amountMax !== undefined ? { lte: filters.amountMax } : {}),
          }
        : undefined;

    const rows = await prisma.payment.findMany({
      where: {
        ...this.companyWhere(filters.companyIds),
        ...(filters.status ? { complianceStatus: filters.status } : {}),
        ...(filters.gateway ? { methodCode: filters.gateway } : {}),
        ...(filters.currency ? { invoiceCurrencyCode: filters.currency } : {}),
        ...(dateFilter ? { paymentDate: dateFilter } : {}),
        ...(amountFilter ? { invoiceAmountApplied: amountFilter } : {}),
        ...(filters.staffUserId ? { invoice: { assignedStaffUserId: filters.staffUserId } } : {}),
      },
      select: {
        id: true,
        companyId: true,
        invoiceId: true,
        customerId: true,
        methodCode: true,
        paymentDate: true,
        invoiceCurrencyCode: true,
        invoiceAmountApplied: true,
        complianceStatus: true,
        externalTransactionId: true,
        invoice: { select: { assignedStaffUserId: true, invoiceNumber: true } },
      },
      orderBy: [{ paymentDate: "desc" }, { id: "asc" }],
    });

    return rows.map((row) => ({
      subjectType: "PAYMENT" as const,
      subjectId: row.id,
      companyId: row.companyId,
      complianceStatus: row.complianceStatus as ComplianceStatus,
      staffUserId: row.invoice.assignedStaffUserId,
      date: row.paymentDate,
      amount: decimalString(row.invoiceAmountApplied),
      currencyCode: row.invoiceCurrencyCode,
      gateway: row.methodCode,
      label: row.externalTransactionId ?? row.invoice.invoiceNumber,
      customerId: row.customerId,
      invoiceId: row.invoiceId,
    }));
  }

  private async listCustomerQueueItems(
    filters: ComplianceQueueListInput,
  ): Promise<ComplianceQueueItem[]> {
    const prisma = getPrisma();
    const dateFilter: Prisma.DateTimeFilter | undefined =
      filters.dateFrom || filters.dateTo
        ? {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: endOfUtcDay(filters.dateTo) } : {}),
          }
        : undefined;

    const companyLinkFilter =
      filters.companyIds === "ALL" ? undefined : { companyId: { in: [...filters.companyIds] } };

    const rows = await prisma.customer.findMany({
      where: {
        ...(filters.companyIds === "ALL"
          ? { companyLinks: { some: {} } }
          : { companyLinks: { some: companyLinkFilter! } }),
        ...(filters.status ? { complianceStatus: filters.status } : {}),
        ...(filters.staffUserId ? { assignedStaffUserId: filters.staffUserId } : {}),
        ...(filters.currency ? { defaultInvoiceCurrencyCode: filters.currency } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        id: true,
        displayName: true,
        createdAt: true,
        defaultInvoiceCurrencyCode: true,
        assignedStaffUserId: true,
        complianceStatus: true,
        companyLinks: {
          ...(companyLinkFilter ? { where: companyLinkFilter } : {}),
          select: { companyId: true },
          orderBy: { companyId: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });

    const items: ComplianceQueueItem[] = [];
    for (const row of rows) {
      for (const link of row.companyLinks) {
        items.push({
          subjectType: "CUSTOMER",
          subjectId: row.id,
          companyId: link.companyId,
          complianceStatus: row.complianceStatus as ComplianceStatus,
          staffUserId: row.assignedStaffUserId,
          date: row.createdAt,
          amount: null,
          currencyCode: row.defaultInvoiceCurrencyCode,
          gateway: null,
          label: row.displayName,
          customerId: row.id,
          invoiceId: null,
        });
      }
    }
    return items;
  }
}
