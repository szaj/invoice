import "server-only";

import type {
  ComplianceStatus,
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
  reviewerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapReview(row: ComplianceReviewRow): ComplianceReviewRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    status: row.status,
    reviewerUserId: row.reviewerUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type ComplianceReviewCreateInput = {
  readonly companyId: string;
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly status: ComplianceStatus;
  readonly reviewerUserId: string | null;
};

/**
 * Persistence for compliance_reviews and subject status columns (TASK-071).
 */
export class PrismaComplianceStore {
  async createReview(input: ComplianceReviewCreateInput): Promise<ComplianceReviewRecord> {
    const prisma = getPrisma();
    const row = await prisma.complianceReview.create({
      data: {
        companyId: input.companyId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        status: input.status,
        reviewerUserId: input.reviewerUserId,
      },
    });
    return mapReview(row as ComplianceReviewRow);
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
}
