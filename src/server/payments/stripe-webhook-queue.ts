/**
 * Queueable Stripe webhook post-processing (ADR-005 / TASK-053).
 * Inline dispatcher runs immediately so HTTP handlers can share the same interface
 * as a future BullMQ worker swap (TASK-099).
 */

export type StripeWebhookProcessingJob = {
  readonly companyId: string;
  readonly payload: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly correlationId: string;
};

export type StripeWebhookProcessingResult = {
  readonly duplicate: boolean;
  readonly outcome:
    | "confirmed"
    | "failed"
    | "already_terminal"
    | "pending_noop"
    | "not_found"
    | "ignored"
    | "duplicate";
  readonly paymentEventId: string | null;
  readonly paymentId: string | null;
};

export interface StripeWebhookJobDispatcher {
  dispatch(job: StripeWebhookProcessingJob): Promise<StripeWebhookProcessingResult>;
}

export type StripeWebhookProcessFn = (
  job: StripeWebhookProcessingJob,
) => Promise<StripeWebhookProcessingResult>;

export class InlineStripeWebhookJobDispatcher implements StripeWebhookJobDispatcher {
  constructor(private readonly process: StripeWebhookProcessFn) {}

  async dispatch(job: StripeWebhookProcessingJob): Promise<StripeWebhookProcessingResult> {
    return this.process(job);
  }
}
