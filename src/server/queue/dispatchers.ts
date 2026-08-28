import { QUEUE_NAMES } from "@/domain/queue/types";
import type { InvoiceEmailJob, InvoiceEmailJobDispatcher } from "@/server/invoices/invoice-email-queue";
import type { InvoicePdfGenerationJob, InvoicePdfJobDispatcher } from "@/server/invoices/invoice-pdf-queue";
import type {
  OperationalNotificationJob,
  OperationalNotificationJobDispatcher,
} from "@/server/notifications/notification-queue";
import type {
  PayPalWebhookJobDispatcher,
  PayPalWebhookProcessingJob,
} from "@/server/payments/paypal-webhook-queue";
import type {
  StripeWebhookJobDispatcher,
  StripeWebhookProcessingJob,
} from "@/server/payments/stripe-webhook-queue";
import type { ReportExportJob, ReportExportJobDispatcher } from "@/server/reporting/report-export-queue";
import { enqueueBackgroundJob } from "@/server/queue/enqueue";
import {
  paypalWebhookIdempotencyKey,
  stripeWebhookIdempotencyKey,
} from "@/server/queue/idempotency";

export function createStripeWebhookBullMqDispatcher(): StripeWebhookJobDispatcher {
  return {
    async dispatch(job: StripeWebhookProcessingJob) {
      await enqueueBackgroundJob({
        queueName: QUEUE_NAMES.stripeWebhook,
        jobName: "process",
        job,
        idempotencyKey: stripeWebhookIdempotencyKey(job.companyId, job.payload),
        correlationId: job.correlationId,
        companyId: job.companyId,
        entityType: "payment_webhook",
      });

      return {
        duplicate: false,
        outcome: "queued",
        paymentEventId: null,
        paymentId: null,
      };
    },
  };
}

export function createPayPalWebhookBullMqDispatcher(): PayPalWebhookJobDispatcher {
  return {
    async dispatch(job: PayPalWebhookProcessingJob) {
      await enqueueBackgroundJob({
        queueName: QUEUE_NAMES.paypalWebhook,
        jobName: "process",
        job,
        idempotencyKey: paypalWebhookIdempotencyKey(job.companyId, job.payload),
        correlationId: job.correlationId,
        companyId: job.companyId,
        entityType: "payment_webhook",
      });

      return {
        duplicate: false,
        outcome: "queued",
        paymentEventId: null,
        paymentId: null,
      };
    },
  };
}

export function createInvoicePdfBullMqDispatcher(): InvoicePdfJobDispatcher {
  return {
    async dispatch(job: InvoicePdfGenerationJob) {
      const versionKey = job.invoiceVersionId ?? "latest";
      await enqueueBackgroundJob({
        queueName: QUEUE_NAMES.invoicePdf,
        jobName: "generate",
        job,
        idempotencyKey: `invoice-pdf:${job.invoiceId}:${versionKey}`,
        companyId: null,
        entityType: "invoice",
        entityId: job.invoiceId,
      });
      return { invoiceFileId: null };
    },
  };
}

export function createInvoiceEmailBullMqDispatcher(): InvoiceEmailJobDispatcher {
  return {
    async dispatch(job: InvoiceEmailJob) {
      const recipientKey = job.recipientOverride ?? "default";
      await enqueueBackgroundJob({
        queueName: QUEUE_NAMES.invoiceEmail,
        jobName: "send",
        job,
        idempotencyKey: `invoice-email:${job.invoiceId}:${recipientKey}`,
        entityType: "invoice",
        entityId: job.invoiceId,
      });
      return { emailLogId: null };
    },
  };
}

export function createReportExportBullMqDispatcher(): ReportExportJobDispatcher {
  return {
    async dispatch(job: ReportExportJob) {
      await enqueueBackgroundJob({
        queueName: QUEUE_NAMES.reportExport,
        jobName: "generate",
        job,
        idempotencyKey: `report-export:${job.exportId}`,
        companyId: job.companyId,
        entityType: "report_export",
        entityId: job.exportId,
      });
    },
  };
}

export function createOperationalNotificationBullMqDispatcher(): OperationalNotificationJobDispatcher {
  return {
    async dispatch(job: OperationalNotificationJob) {
      await enqueueBackgroundJob({
        queueName: QUEUE_NAMES.operationalNotification,
        jobName: "send",
        job,
        idempotencyKey: `notification:${job.event.kind}:${job.subject}`,
        entityType: "notification",
      });
    },
  };
}
