export const BACKGROUND_JOB_STATUSES = [
  "QUEUED",
  "ACTIVE",
  "COMPLETED",
  "FAILED",
  "DUPLICATE_SKIPPED",
] as const;

export type BackgroundJobStatus = (typeof BACKGROUND_JOB_STATUSES)[number];

export const QUEUE_NAMES = {
  stripeWebhook: "stripe-webhook",
  paypalWebhook: "paypal-webhook",
  invoicePdf: "invoice-pdf",
  invoiceEmail: "invoice-email",
  reportExport: "report-export",
  operationalNotification: "operational-notification",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface BackgroundJobRecord {
  readonly id: string;
  readonly queueName: string;
  readonly jobName: string;
  readonly bullJobId: string | null;
  readonly idempotencyKey: string | null;
  readonly correlationId: string | null;
  readonly status: BackgroundJobStatus;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly lastError: string | null;
  readonly companyId: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}
