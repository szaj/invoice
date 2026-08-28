/**
 * Queueable PayPal webhook post-processing (ADR-005 / TASK-055).
 * Inline dispatcher runs immediately so HTTP handlers can share the same interface
 * as a future BullMQ worker swap (TASK-099).
 */

export type PayPalWebhookProcessingJob = {
  readonly companyId: string;
  readonly payload: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly correlationId: string;
};

export type PayPalWebhookProcessingResult = {
  readonly duplicate: boolean;
  readonly outcome:
    | "confirmed"
    | "failed"
    | "already_terminal"
    | "pending_noop"
    | "not_found"
    | "ignored"
    | "duplicate"
    | "queued";
  readonly paymentEventId: string | null;
  readonly paymentId: string | null;
};

export interface PayPalWebhookJobDispatcher {
  dispatch(job: PayPalWebhookProcessingJob): Promise<PayPalWebhookProcessingResult>;
}

export type PayPalWebhookProcessFn = (
  job: PayPalWebhookProcessingJob,
) => Promise<PayPalWebhookProcessingResult>;

export class InlinePayPalWebhookJobDispatcher implements PayPalWebhookJobDispatcher {
  constructor(private readonly process: PayPalWebhookProcessFn) {}

  async dispatch(job: PayPalWebhookProcessingJob): Promise<PayPalWebhookProcessingResult> {
    return this.process(job);
  }
}
