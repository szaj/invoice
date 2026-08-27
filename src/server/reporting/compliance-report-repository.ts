import "server-only";

import { Prisma } from "@/generated/prisma/client";

import type { ComplianceStatus, ComplianceReviewSubjectType } from "@/domain/compliance/types";
import type { ComplianceReportQuery } from "@/domain/reporting/schema";
import type {
  ComplianceReportSourceNote,
  ComplianceReportSourceSubject,
} from "@/domain/reporting/types";
import { getPrisma } from "@/server/db/client";

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

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

export type ComplianceReportSourceFilters = ComplianceReportQuery & {
  readonly companyIds: readonly string[] | "ALL";
};

/**
 * Read-model for Compliance Report (TASK-087 / §13.3).
 * Subjects come from invoice/payment/customer compliance status (queue shape).
 * Notes references come from compliance_reviews with note/reason/resolution/evidence content.
 */
export class PrismaComplianceReportStore {
  async listCompanyIdsInReportingGroup(reportingGroupId: string): Promise<readonly string[]> {
    const prisma = getPrisma();
    const rows = await prisma.company.findMany({
      where: { reportingGroupId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** Filter options only — membership is not authorization. */
  async listReportingGroupOptions(): Promise<readonly { id: string; name: string }[]> {
    const prisma = getPrisma();
    const rows = await prisma.companyGroup.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async listSubjects(
    filters: ComplianceReportSourceFilters,
  ): Promise<readonly ComplianceReportSourceSubject[]> {
    if (filters.companyIds !== "ALL" && filters.companyIds.length === 0) {
      return [];
    }

    const includeInvoices =
      (!filters.subjectType || filters.subjectType === "INVOICE") && !filters.gateway;
    const includePayments = !filters.subjectType || filters.subjectType === "PAYMENT";
    const includeCustomers =
      (!filters.subjectType || filters.subjectType === "CUSTOMER") && !filters.gateway;

    const [invoices, payments, customers] = await Promise.all([
      includeInvoices ? this.listInvoiceSubjects(filters) : Promise.resolve([]),
      includePayments ? this.listPaymentSubjects(filters) : Promise.resolve([]),
      includeCustomers ? this.listCustomerSubjects(filters) : Promise.resolve([]),
    ]);

    return [...invoices, ...payments, ...customers];
  }

  async listNoteReferences(
    filters: ComplianceReportSourceFilters,
  ): Promise<readonly ComplianceReportSourceNote[]> {
    if (filters.companyIds !== "ALL" && filters.companyIds.length === 0) {
      return [];
    }

    const prisma = getPrisma();
    const dateFilter: Prisma.DateTimeFilter | undefined =
      filters.dateFrom || filters.dateTo
        ? {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: endOfUtcDay(filters.dateTo) } : {}),
          }
        : undefined;

    const rows = await prisma.complianceReview.findMany({
      where: {
        ...(filters.companyIds === "ALL" ? {} : { companyId: { in: [...filters.companyIds] } }),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.subjectType ? { subjectType: filters.subjectType } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        OR: [
          { notes: { not: null } },
          { reason: { not: null } },
          { resolutionNotes: { not: null } },
          { evidenceRefs: { not: Prisma.DbNull } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 500,
    });

    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      subjectType: row.subjectType as ComplianceReviewSubjectType,
      subjectId: row.subjectId,
      status: row.status as ComplianceStatus,
      notes: row.notes,
      reason: row.reason,
      resolutionNotes: row.resolutionNotes,
      evidenceRefs: mapEvidenceRefs(row.evidenceRefs),
      reviewerUserId: row.reviewerUserId,
      createdAt: row.createdAt,
      label: null,
    }));
  }

  private companyWhere(companyIds: readonly string[] | "ALL"): { companyId?: { in: string[] } } {
    if (companyIds === "ALL") {
      return {};
    }
    return { companyId: { in: [...companyIds] } };
  }

  private async listInvoiceSubjects(
    filters: ComplianceReportSourceFilters,
  ): Promise<ComplianceReportSourceSubject[]> {
    const prisma = getPrisma();
    const dateFilter: Prisma.DateTimeFilter | undefined =
      filters.dateFrom || filters.dateTo
        ? {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: endOfUtcDay(filters.dateTo) } : {}),
          }
        : undefined;

    const rows = await prisma.invoice.findMany({
      where: {
        ...this.companyWhere(filters.companyIds),
        ...(filters.status ? { complianceStatus: filters.status } : {}),
        ...(filters.staffUserId ? { assignedStaffUserId: filters.staffUserId } : {}),
        ...(filters.currency ? { currencyCode: filters.currency } : {}),
        ...(dateFilter ? { invoiceDate: dateFilter } : {}),
      },
      select: {
        id: true,
        companyId: true,
        invoiceNumber: true,
        invoiceDate: true,
        complianceStatus: true,
      },
    });

    return rows.map((row) => ({
      subjectType: "INVOICE" as const,
      subjectId: row.id,
      companyId: row.companyId,
      complianceStatus: row.complianceStatus as ComplianceStatus,
      date: row.invoiceDate,
      label: row.invoiceNumber,
    }));
  }

  private async listPaymentSubjects(
    filters: ComplianceReportSourceFilters,
  ): Promise<ComplianceReportSourceSubject[]> {
    const prisma = getPrisma();
    const dateFilter: Prisma.DateTimeFilter | undefined =
      filters.dateFrom || filters.dateTo
        ? {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: endOfUtcDay(filters.dateTo) } : {}),
          }
        : undefined;

    const rows = await prisma.payment.findMany({
      where: {
        ...this.companyWhere(filters.companyIds),
        ...(filters.status ? { complianceStatus: filters.status } : {}),
        ...(filters.gateway ? { methodCode: filters.gateway } : {}),
        ...(filters.currency ? { invoiceCurrencyCode: filters.currency } : {}),
        ...(dateFilter ? { paymentDate: dateFilter } : {}),
        ...(filters.staffUserId ? { invoice: { assignedStaffUserId: filters.staffUserId } } : {}),
      },
      select: {
        id: true,
        companyId: true,
        paymentDate: true,
        complianceStatus: true,
        externalTransactionId: true,
        invoice: { select: { invoiceNumber: true } },
      },
    });

    return rows.map((row) => ({
      subjectType: "PAYMENT" as const,
      subjectId: row.id,
      companyId: row.companyId,
      complianceStatus: row.complianceStatus as ComplianceStatus,
      date: row.paymentDate,
      label: row.externalTransactionId ?? row.invoice.invoiceNumber,
    }));
  }

  private async listCustomerSubjects(
    filters: ComplianceReportSourceFilters,
  ): Promise<ComplianceReportSourceSubject[]> {
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
        complianceStatus: true,
        companyLinks: {
          ...(companyLinkFilter ? { where: companyLinkFilter } : {}),
          select: { companyId: true },
          orderBy: { companyId: "asc" },
        },
      },
    });

    const items: ComplianceReportSourceSubject[] = [];
    for (const row of rows) {
      for (const link of row.companyLinks) {
        items.push({
          subjectType: "CUSTOMER",
          subjectId: row.id,
          companyId: link.companyId,
          complianceStatus: row.complianceStatus as ComplianceStatus,
          date: row.createdAt,
          label: row.displayName,
        });
      }
    }
    return items;
  }
}
