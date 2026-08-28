import type { OperationalNotificationEvent } from "@/domain/notifications/types";

export type OperationalNotificationContent = {
  readonly subject: string;
  readonly text: string;
};

function invoiceLabel(invoiceNumber: string | null, invoiceId: string): string {
  return invoiceNumber?.trim() || invoiceId.slice(0, 8);
}

export function buildOperationalNotificationContent(
  event: OperationalNotificationEvent,
): OperationalNotificationContent {
  switch (event.kind) {
    case "INVOICE_EMAIL_SENT":
      return {
        subject: `Invoice email sent: ${invoiceLabel(event.invoiceNumber, event.invoiceId)}`,
        text: [
          "An invoice email was sent successfully.",
          "",
          `Invoice: ${invoiceLabel(event.invoiceNumber, event.invoiceId)}`,
          `Recipient: ${event.recipient}`,
          `Company ID: ${event.companyId}`,
        ].join("\n"),
      };
    case "INVOICE_EMAIL_FAILED":
      return {
        subject: `Invoice email failed: ${invoiceLabel(event.invoiceNumber, event.invoiceId)}`,
        text: [
          "An invoice email delivery attempt failed.",
          "",
          `Invoice: ${invoiceLabel(event.invoiceNumber, event.invoiceId)}`,
          `Recipient: ${event.recipient}`,
          `Company ID: ${event.companyId}`,
          event.errorMessage ? `Error: ${event.errorMessage}` : null,
        ]
          .filter((line): line is string => line != null)
          .join("\n"),
      };
    case "PAYMENT_SUCCESS":
      return {
        subject: `Payment received: ${invoiceLabel(event.invoiceNumber, event.invoiceId)}`,
        text: [
          "A payment was confirmed successfully.",
          "",
          `Payment ID: ${event.paymentId}`,
          `Invoice: ${invoiceLabel(event.invoiceNumber, event.invoiceId)}`,
          `Amount: ${event.amount} ${event.currencyCode}`,
          `Method: ${event.methodCode}`,
          `Company ID: ${event.companyId}`,
        ].join("\n"),
      };
    case "PAYMENT_FAILED":
      return {
        subject: `Payment failed: ${invoiceLabel(event.invoiceNumber, event.invoiceId)}`,
        text: [
          "A payment was marked failed.",
          "",
          `Payment ID: ${event.paymentId}`,
          `Invoice: ${invoiceLabel(event.invoiceNumber, event.invoiceId)}`,
          `Amount: ${event.amount} ${event.currencyCode}`,
          `Method: ${event.methodCode}`,
          `Company ID: ${event.companyId}`,
        ].join("\n"),
      };
    case "INVOICE_OVERDUE":
      return {
        subject: `Invoice overdue: ${invoiceLabel(event.invoiceNumber, event.invoiceId)}`,
        text: [
          "An invoice is now overdue.",
          "",
          `Invoice: ${invoiceLabel(event.invoiceNumber, event.invoiceId)}`,
          `Customer: ${event.customerName}`,
          `Due date: ${event.dueDate}`,
          `Balance due: ${event.balanceDue} ${event.currencyCode}`,
          `Company ID: ${event.companyId}`,
        ].join("\n"),
      };
    case "COMPLIANCE_FLAGGED":
      return {
        subject: `Compliance flagged: ${event.subjectType} ${event.subjectLabel}`,
        text: [
          "A compliance review item was flagged.",
          "",
          `Subject: ${event.subjectType} ${event.subjectLabel}`,
          `Status: ${event.status}`,
          event.reason ? `Reason: ${event.reason}` : null,
          event.notes ? `Notes: ${event.notes}` : null,
          `Company ID: ${event.companyId}`,
        ]
          .filter((line): line is string => line != null)
          .join("\n"),
      };
    case "GATEWAY_FAILURE":
      return {
        subject: `Gateway ${event.failureType.toLowerCase()} alert${
          event.methodCode ? `: ${event.methodCode}` : ""
        }`,
        text: [
          "A gateway configuration or webhook failure requires Admin attention.",
          "",
          `Failure type: ${event.failureType}`,
          event.methodCode ? `Method: ${event.methodCode}` : null,
          event.companyId ? `Company ID: ${event.companyId}` : null,
          `Details: ${event.message}`,
        ]
          .filter((line): line is string => line != null)
          .join("\n"),
      };
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}
