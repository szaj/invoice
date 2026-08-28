import type { Job, Worker } from "bullmq";
import { Worker as BullWorker } from "bullmq";

import { QUEUE_NAMES } from "@/domain/queue/types";
import { logger } from "@/lib/logger";
import { sendInvoiceEmail } from "@/server/invoices/invoice-email-service";
import type { InvoiceEmailJob } from "@/server/invoices/invoice-email-queue";
import { generateInvoicePdf } from "@/server/invoices/invoice-pdf-service";
import type { InvoicePdfGenerationJob } from "@/server/invoices/invoice-pdf-queue";
import { sendOperationalNotificationJob } from "@/server/notifications/notification-service";
import type { OperationalNotificationJob } from "@/server/notifications/notification-queue";
import { processPayPalWebhookJob } from "@/server/payments/paypal-webhook-service";
import type { PayPalWebhookProcessingJob } from "@/server/payments/paypal-webhook-queue";
import { processStripeWebhookJob } from "@/server/payments/stripe-webhook-service";
import type { StripeWebhookProcessingJob } from "@/server/payments/stripe-webhook-queue";
import { processReportExportJob } from "@/server/reporting/report-export-service";
import type { ReportExportJob } from "@/server/reporting/report-export-queue";
import { getDefaultJobOptions } from "@/server/queue/config";
import { getRedisConnection } from "@/server/queue/connection";
import { PrismaBackgroundJobStore } from "@/server/queue/job-metadata-repository";
import { loadAuthorizationPrincipalByUserId } from "@/server/authz/principal";

const metadataStore = new PrismaBackgroundJobStore();

async function recordJobLifecycle<T>(
  bullJob: Job<T>,
  handler: () => Promise<{ readonly duplicate?: boolean } | void>,
): Promise<void> {
  const bullJobId = bullJob.id;
  if (!bullJobId) {
    await handler();
    return;
  }

  await metadataStore.markActive(bullJobId, bullJob.attemptsMade + 1);

  try {
    const result = await handler();
    const duplicate = result && "duplicate" in result ? Boolean(result.duplicate) : false;
    await metadataStore.markCompleted(bullJobId, duplicate ? "DUPLICATE_SKIPPED" : "COMPLETED");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const exhausted = bullJob.attemptsMade + 1 >= (bullJob.opts.attempts ?? getDefaultJobOptions().attempts);
    await metadataStore.markFailed(bullJobId, message, exhausted);
    logger.error(
      {
        event: "queue.job_failed",
        queueName: bullJob.queueName,
        bullJobId,
        attemptsMade: bullJob.attemptsMade + 1,
        exhausted,
        err: message.slice(0, 200),
      },
      "Background job failed",
    );
    throw error;
  }
}

async function processInvoicePdfWorkerJob(job: InvoicePdfGenerationJob): Promise<void> {
  const actor = job.actorUserId ? await loadAuthorizationPrincipalByUserId(job.actorUserId) : null;
  const result = await generateInvoicePdf(actor, job.invoiceId, {
    invoiceVersionId: job.invoiceVersionId,
    pageSize: job.pageSize,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
}

async function processInvoiceEmailWorkerJob(job: InvoiceEmailJob): Promise<void> {
  const actor = job.actorUserId ? await loadAuthorizationPrincipalByUserId(job.actorUserId) : null;
  const result = await sendInvoiceEmail(
    actor,
    job.invoiceId,
    {
      invoiceFileId: job.invoiceFileId,
      recipientOverride: job.recipientOverride,
      paymentLink: job.paymentLink,
    },
  );
  if (!result.ok) {
    throw new Error(result.error);
  }
}

export function createQueueWorkers(): Worker[] {
  const connection = getRedisConnection();

  return [
    new BullWorker<StripeWebhookProcessingJob>(
      QUEUE_NAMES.stripeWebhook,
      async (bullJob) => {
        await recordJobLifecycle(bullJob, async () => processStripeWebhookJob(bullJob.data, {}));
      },
      { connection },
    ),
    new BullWorker<PayPalWebhookProcessingJob>(
      QUEUE_NAMES.paypalWebhook,
      async (bullJob) => {
        await recordJobLifecycle(bullJob, async () => processPayPalWebhookJob(bullJob.data, {}));
      },
      { connection },
    ),
    new BullWorker<InvoicePdfGenerationJob>(
      QUEUE_NAMES.invoicePdf,
      async (bullJob) => {
        await recordJobLifecycle(bullJob, async () => {
          await processInvoicePdfWorkerJob(bullJob.data);
        });
      },
      { connection },
    ),
    new BullWorker<InvoiceEmailJob>(
      QUEUE_NAMES.invoiceEmail,
      async (bullJob) => {
        await recordJobLifecycle(bullJob, async () => {
          await processInvoiceEmailWorkerJob(bullJob.data);
        });
      },
      { connection },
    ),
    new BullWorker<ReportExportJob>(
      QUEUE_NAMES.reportExport,
      async (bullJob) => {
        await recordJobLifecycle(bullJob, async () => {
          await processReportExportJob(bullJob.data, {});
        });
      },
      { connection },
    ),
    new BullWorker<OperationalNotificationJob>(
      QUEUE_NAMES.operationalNotification,
      async (bullJob) => {
        await recordJobLifecycle(bullJob, async () => {
          await sendOperationalNotificationJob(bullJob.data, {});
        });
      },
      { connection },
    ),
  ];
}

export async function closeQueueWorkers(workers: Worker[]): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()));
}
