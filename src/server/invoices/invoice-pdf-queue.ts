/**
 * Queueable PDF generation (ADR-005).
 * TASK-039 uses an inline dispatcher so generation works without a dedicated worker.
 * TASK-099 hardens BullMQ + Redis + worker processing; swap the dispatcher there.
 */

export type InvoicePdfGenerationJob = {
  readonly invoiceId: string;
  readonly invoiceVersionId?: string | null;
  readonly actorUserId: string | null;
  readonly pageSize?: "A4" | "LETTER";
};

export interface InvoicePdfJobDispatcher {
  /**
   * Dispatch PDF generation. Inline implementation runs immediately and returns the file id.
   * Future BullMQ implementation may return null when only enqueued.
   */
  dispatch(job: InvoicePdfGenerationJob): Promise<{ readonly invoiceFileId: string | null }>;
}

export type InvoicePdfGenerateFn = (
  job: InvoicePdfGenerationJob,
) => Promise<{ readonly invoiceFileId: string }>;

export class InlineInvoicePdfJobDispatcher implements InvoicePdfJobDispatcher {
  constructor(private readonly generate: InvoicePdfGenerateFn) {}

  async dispatch(job: InvoicePdfGenerationJob): Promise<{ readonly invoiceFileId: string | null }> {
    const result = await this.generate(job);
    return { invoiceFileId: result.invoiceFileId };
  }
}
