import type { ComplianceStatus } from "@/domain/compliance/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";

export const OPERATIONAL_NOTIFICATION_KINDS = [
  "INVOICE_EMAIL_SENT",
  "INVOICE_EMAIL_FAILED",
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "INVOICE_OVERDUE",
  "COMPLIANCE_FLAGGED",
  "GATEWAY_FAILURE",
] as const;

export type OperationalNotificationKind = (typeof OPERATIONAL_NOTIFICATION_KINDS)[number];

export type OperationalNotificationEvent =
  | {
      readonly kind: "INVOICE_EMAIL_SENT" | "INVOICE_EMAIL_FAILED";
      readonly companyId: string;
      readonly invoiceId: string;
      readonly invoiceNumber: string | null;
      readonly recipient: string;
      readonly errorMessage?: string | null;
    }
  | {
      readonly kind: "PAYMENT_SUCCESS" | "PAYMENT_FAILED";
      readonly companyId: string;
      readonly paymentId: string;
      readonly invoiceId: string;
      readonly invoiceNumber: string | null;
      readonly amount: string;
      readonly currencyCode: string;
      readonly methodCode: PaymentMethodCode;
    }
  | {
      readonly kind: "INVOICE_OVERDUE";
      readonly companyId: string;
      readonly invoiceId: string;
      readonly invoiceNumber: string | null;
      readonly customerName: string;
      readonly dueDate: string;
      readonly balanceDue: string;
      readonly currencyCode: string;
      readonly assignedStaffUserId: string | null;
    }
  | {
      readonly kind: "COMPLIANCE_FLAGGED";
      readonly companyId: string;
      readonly subjectType: "INVOICE" | "PAYMENT" | "CUSTOMER";
      readonly subjectId: string;
      readonly subjectLabel: string;
      readonly status: ComplianceStatus;
      readonly reason: string | null;
      readonly notes: string | null;
    }
  | {
      readonly kind: "GATEWAY_FAILURE";
      readonly companyId: string | null;
      readonly methodCode: PaymentMethodCode | null;
      readonly failureType: "WEBHOOK" | "CONFIGURATION";
      readonly message: string;
    };

export type NotificationSettingsFlags = {
  readonly notifyInvoiceEmailSent: boolean;
  readonly notifyInvoiceEmailFailed: boolean;
  readonly notifyPaymentSuccess: boolean;
  readonly notifyPaymentFailed: boolean;
  readonly notifyInvoiceOverdue: boolean;
  readonly notifyInvoiceOverdueToAdmin: boolean;
  readonly notifyInvoiceOverdueToAssignedStaff: boolean;
  readonly notifyComplianceFlagged: boolean;
  readonly notifyGatewayFailure: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsFlags = {
  notifyInvoiceEmailSent: true,
  notifyInvoiceEmailFailed: true,
  notifyPaymentSuccess: false,
  notifyPaymentFailed: false,
  notifyInvoiceOverdue: true,
  notifyInvoiceOverdueToAdmin: true,
  notifyInvoiceOverdueToAssignedStaff: true,
  notifyComplianceFlagged: true,
  notifyGatewayFailure: true,
};
