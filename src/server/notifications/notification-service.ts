import "server-only";

import { logger } from "@/lib/logger";
import { dedupeRecipientEmails } from "@/domain/notifications/recipients";
import {
  isOperationalNotificationEnabled,
  notificationKindOf,
  overdueRecipientFlags,
} from "@/domain/notifications/settings";
import { buildOperationalNotificationContent } from "@/domain/notifications/templates";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettingsFlags,
  type OperationalNotificationEvent,
} from "@/domain/notifications/types";
import { createEmailService, type EmailService } from "@/server/email/email-service";
import {
  InlineOperationalNotificationJobDispatcher,
  type OperationalNotificationJob,
  type OperationalNotificationJobDispatcher,
} from "@/server/notifications/notification-queue";
import { PrismaNotificationRecipientStore } from "@/server/notifications/notification-recipient-repository";
import { PrismaSystemSettingsStore } from "@/server/settings/settings-repository";
import { isQueueEnabled } from "@/server/queue/config";
import { createOperationalNotificationBullMqDispatcher } from "@/server/queue/dispatchers";

export interface NotificationServiceDependencies {
  readonly settings?: Pick<PrismaSystemSettingsStore, "getSettings">;
  readonly recipients?: Pick<
    PrismaNotificationRecipientStore,
    | "listActiveAdminEmails"
    | "listActiveComplianceEmailsForCompany"
    | "getActiveUserEmail"
    | "isUserAssignedToCompany"
  >;
  readonly emailService?: EmailService;
  readonly dispatcher?: OperationalNotificationJobDispatcher;
}

export interface OperationalNotificationEmitter {
  emit(event: OperationalNotificationEvent): Promise<void>;
}

function settingsOf(
  deps: NotificationServiceDependencies,
): Pick<PrismaSystemSettingsStore, "getSettings"> {
  return deps.settings ?? new PrismaSystemSettingsStore();
}

function recipientsOf(
  deps: NotificationServiceDependencies,
): Pick<
  PrismaNotificationRecipientStore,
  | "listActiveAdminEmails"
  | "listActiveComplianceEmailsForCompany"
  | "getActiveUserEmail"
  | "isUserAssignedToCompany"
> {
  return deps.recipients ?? new PrismaNotificationRecipientStore();
}

function emailServiceOf(deps: NotificationServiceDependencies): EmailService {
  return deps.emailService ?? createEmailService();
}

async function notificationSettingsOf(
  deps: NotificationServiceDependencies,
): Promise<NotificationSettingsFlags> {
  const row = await settingsOf(deps).getSettings();
  if (!row) {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
  return {
    notifyInvoiceEmailSent: row.notifyInvoiceEmailSent,
    notifyInvoiceEmailFailed: row.notifyInvoiceEmailFailed,
    notifyPaymentSuccess: row.notifyPaymentSuccess,
    notifyPaymentFailed: row.notifyPaymentFailed,
    notifyInvoiceOverdue: row.notifyInvoiceOverdue,
    notifyInvoiceOverdueToAdmin: row.notifyInvoiceOverdueToAdmin,
    notifyInvoiceOverdueToAssignedStaff: row.notifyInvoiceOverdueToAssignedStaff,
    notifyComplianceFlagged: row.notifyComplianceFlagged,
    notifyGatewayFailure: row.notifyGatewayFailure,
  };
}

async function resolveRecipients(
  event: OperationalNotificationEvent,
  settings: NotificationSettingsFlags,
  deps: NotificationServiceDependencies,
): Promise<string[]> {
  const store = recipientsOf(deps);

  switch (event.kind) {
    case "INVOICE_EMAIL_SENT":
    case "INVOICE_EMAIL_FAILED":
    case "PAYMENT_SUCCESS":
    case "PAYMENT_FAILED":
      return dedupeRecipientEmails(await store.listActiveAdminEmails());
    case "INVOICE_OVERDUE": {
      const { notifyAdmin, notifyAssignedStaff } = overdueRecipientFlags(settings);
      const emails: string[] = [];
      if (notifyAdmin) {
        emails.push(...(await store.listActiveAdminEmails()));
      }
      if (notifyAssignedStaff && event.assignedStaffUserId) {
        const assigned = await store.getActiveUserEmail(event.assignedStaffUserId);
        if (
          assigned &&
          (await store.isUserAssignedToCompany(event.assignedStaffUserId, event.companyId))
        ) {
          emails.push(assigned);
        }
      }
      return dedupeRecipientEmails(emails);
    }
    case "COMPLIANCE_FLAGGED": {
      const adminEmails = await store.listActiveAdminEmails();
      const complianceEmails = await store.listActiveComplianceEmailsForCompany(event.companyId);
      return dedupeRecipientEmails([...adminEmails, ...complianceEmails]);
    }
    case "GATEWAY_FAILURE":
      return dedupeRecipientEmails(await store.listActiveAdminEmails());
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

export async function sendOperationalNotificationJob(
  job: OperationalNotificationJob,
  deps: NotificationServiceDependencies,
): Promise<void> {
  if (job.recipients.length === 0) {
    return;
  }

  const emailService = emailServiceOf(deps);
  for (const recipient of job.recipients) {
    await emailService.send({
      to: recipient,
      subject: job.subject,
      text: job.text,
    });
  }

  logger.info(
    {
      event: "notifications.sent",
      kind: job.event.kind,
      recipientCount: job.recipients.length,
      companyId: "companyId" in job.event ? job.event.companyId : null,
    },
    "Operational notification sent",
  );
}

function dispatcherOf(deps: NotificationServiceDependencies): OperationalNotificationJobDispatcher {
  if (deps.dispatcher) {
    return deps.dispatcher;
  }
  const processFn = (queued: OperationalNotificationJob) =>
    sendOperationalNotificationJob(queued, deps);
  if (isQueueEnabled()) {
    return createOperationalNotificationBullMqDispatcher();
  }
  return new InlineOperationalNotificationJobDispatcher(processFn);
}

export class OperationalNotificationService implements OperationalNotificationEmitter {
  constructor(private readonly deps: NotificationServiceDependencies = {}) {}

  async emit(event: OperationalNotificationEvent): Promise<void> {
    const settings = await notificationSettingsOf(this.deps);
    const kind = notificationKindOf(event);
    if (!isOperationalNotificationEnabled(kind, settings)) {
      return;
    }

    const recipients = await resolveRecipients(event, settings, this.deps);
    if (recipients.length === 0) {
      return;
    }

    const content = buildOperationalNotificationContent(event);
    const job: OperationalNotificationJob = {
      event,
      recipients,
      subject: content.subject,
      text: content.text,
    };

    const dispatcher = dispatcherOf(this.deps);

    await dispatcher.dispatch(job);
  }
}

export function createDefaultOperationalNotificationEmitter(): OperationalNotificationEmitter {
  return new OperationalNotificationService();
}

/**
 * Best-effort operational notification. Never throws to callers.
 */
export async function emitOperationalNotification(
  event: OperationalNotificationEvent,
  emitter?: OperationalNotificationEmitter,
): Promise<void> {
  try {
    await (emitter ?? createDefaultOperationalNotificationEmitter()).emit(event);
  } catch (error) {
    logger.error(
      {
        event: "notifications.emit_failed",
        kind: event.kind,
        err: error instanceof Error ? error.message : "unknown",
      },
      "Operational notification failed",
    );
  }
}
