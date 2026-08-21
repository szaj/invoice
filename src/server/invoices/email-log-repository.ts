import "server-only";

import type { EmailDeliveryStatus, EmailLogRecord } from "@/domain/invoices/email";
import { getPrisma } from "@/server/db/client";

function mapRow(row: {
  id: string;
  companyId: string;
  invoiceId: string;
  invoiceFileId: string | null;
  recipient: string;
  subject: string;
  status: EmailDeliveryStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  retryable: boolean;
  sentByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EmailLogRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    invoiceId: row.invoiceId,
    invoiceFileId: row.invoiceFileId,
    recipient: row.recipient,
    subject: row.subject,
    status: row.status,
    providerMessageId: row.providerMessageId,
    errorMessage: row.errorMessage,
    retryable: row.retryable,
    sentByUserId: row.sentByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaEmailLogStore {
  async create(input: {
    readonly companyId: string;
    readonly invoiceId: string;
    readonly invoiceFileId: string | null;
    readonly recipient: string;
    readonly subject: string;
    readonly status: EmailDeliveryStatus;
    readonly providerMessageId: string | null;
    readonly errorMessage: string | null;
    readonly retryable: boolean;
    readonly sentByUserId: string | null;
  }): Promise<EmailLogRecord> {
    const prisma = getPrisma();
    const created = await prisma.emailLog.create({
      data: {
        companyId: input.companyId,
        invoiceId: input.invoiceId,
        invoiceFileId: input.invoiceFileId,
        recipient: input.recipient,
        subject: input.subject,
        status: input.status,
        providerMessageId: input.providerMessageId,
        errorMessage: input.errorMessage,
        retryable: input.retryable,
        sentByUserId: input.sentByUserId,
      },
    });
    return mapRow(created);
  }

  async listByInvoiceId(invoiceId: string): Promise<EmailLogRecord[]> {
    const prisma = getPrisma();
    const rows = await prisma.emailLog.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapRow);
  }
}
