/**
 * Queueable invoice email (ADR-005).
 * TASK-041 uses an inline dispatcher; TASK-099 hardens BullMQ workers.
 */

export type InvoiceEmailJob = {
  readonly invoiceId: string;
  readonly invoiceFileId?: string | null;
  readonly recipientOverride?: string | null;
  readonly paymentLink?: string | null;
  readonly actorUserId: string | null;
};

export interface InvoiceEmailJobDispatcher {
  dispatch(job: InvoiceEmailJob): Promise<{ readonly emailLogId: string | null }>;
}

export type InvoiceEmailSendFn = (job: InvoiceEmailJob) => Promise<{ readonly emailLogId: string }>;

export class InlineInvoiceEmailJobDispatcher implements InvoiceEmailJobDispatcher {
  constructor(private readonly send: InvoiceEmailSendFn) {}

  async dispatch(job: InvoiceEmailJob): Promise<{ readonly emailLogId: string | null }> {
    const result = await this.send(job);
    return { emailLogId: result.emailLogId };
  }
}
