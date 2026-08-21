import "server-only";

import { getPrisma } from "@/server/db/client";
import {
  formatInvoiceNumber,
  invoiceNumberYearForTimezone,
  INVOICE_NUMBER_PREFIX_REQUIRED,
} from "@/domain/invoices/numbering";

export type AllocatedInvoiceNumber = {
  readonly invoiceNumber: string;
  readonly sequence: number;
  readonly companyId: string;
  readonly prefix: string;
  readonly year: number | null;
};

/**
 * Atomically allocate the next invoice number for a company (TASK-035 / BR-003).
 * Uses row-level lock so concurrent callers cannot share a sequence value.
 */
export class PrismaInvoiceNumberStore {
  async allocateNextInvoiceNumber(companyId: string): Promise<AllocatedInvoiceNumber> {
    const prisma = getPrisma();
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          invoice_prefix: string | null;
          invoice_sequence_next: number;
        }>
      >`
        SELECT id, invoice_prefix, invoice_sequence_next
        FROM companies
        WHERE id = ${companyId}::uuid
        FOR UPDATE
      `;
      const company = locked[0];
      if (!company) {
        throw new Error("Company not found.");
      }
      const prefix = company.invoice_prefix?.trim() ?? "";
      if (prefix.length === 0) {
        throw new Error(INVOICE_NUMBER_PREFIX_REQUIRED);
      }

      const sequence = company.invoice_sequence_next;
      await tx.company.update({
        where: { id: companyId },
        data: { invoiceSequenceNext: sequence + 1 },
      });

      const settings = await tx.systemSettings.findFirst({
        select: {
          invoiceNumberIncludeYear: true,
          defaultTimezone: true,
        },
      });
      const includeYear = settings?.invoiceNumberIncludeYear === true;
      const timeZone = settings?.defaultTimezone ?? "UTC";
      const year = includeYear ? invoiceNumberYearForTimezone(timeZone) : null;
      const invoiceNumber = formatInvoiceNumber({ prefix, sequence, year });

      return {
        invoiceNumber,
        sequence,
        companyId,
        prefix,
        year,
      };
    });
  }

  async invoiceNumberExists(companyId: string, invoiceNumber: string): Promise<boolean> {
    const prisma = getPrisma();
    const existing = await prisma.invoice.findFirst({
      where: { companyId, invoiceNumber },
      select: { id: true },
    });
    return existing != null;
  }

  async setInvoiceNumber(invoiceId: string, invoiceNumber: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { invoiceNumber },
    });
  }
}
