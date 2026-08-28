import type {
  NotificationSettingsFlags,
  OperationalNotificationEvent,
  OperationalNotificationKind,
} from "@/domain/notifications/types";

export function isOperationalNotificationEnabled(
  kind: OperationalNotificationKind,
  settings: NotificationSettingsFlags,
): boolean {
  switch (kind) {
    case "INVOICE_EMAIL_SENT":
      return settings.notifyInvoiceEmailSent;
    case "INVOICE_EMAIL_FAILED":
      return settings.notifyInvoiceEmailFailed;
    case "PAYMENT_SUCCESS":
      return settings.notifyPaymentSuccess;
    case "PAYMENT_FAILED":
      return settings.notifyPaymentFailed;
    case "INVOICE_OVERDUE":
      return settings.notifyInvoiceOverdue;
    case "COMPLIANCE_FLAGGED":
      return settings.notifyComplianceFlagged;
    case "GATEWAY_FAILURE":
      return settings.notifyGatewayFailure;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function overdueRecipientFlags(settings: NotificationSettingsFlags): {
  readonly notifyAdmin: boolean;
  readonly notifyAssignedStaff: boolean;
} {
  if (!settings.notifyInvoiceOverdue) {
    return { notifyAdmin: false, notifyAssignedStaff: false };
  }
  return {
    notifyAdmin: settings.notifyInvoiceOverdueToAdmin,
    notifyAssignedStaff: settings.notifyInvoiceOverdueToAssignedStaff,
  };
}

export function notificationKindOf(
  event: OperationalNotificationEvent,
): OperationalNotificationKind {
  return event.kind;
}
