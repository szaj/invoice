import { z } from "zod";

export const notificationSettingsUpdateSchema = z.object({
  notifyInvoiceEmailSent: z.boolean(),
  notifyInvoiceEmailFailed: z.boolean(),
  notifyPaymentSuccess: z.boolean(),
  notifyPaymentFailed: z.boolean(),
  notifyInvoiceOverdue: z.boolean(),
  notifyInvoiceOverdueToAdmin: z.boolean(),
  notifyInvoiceOverdueToAssignedStaff: z.boolean(),
  notifyComplianceFlagged: z.boolean(),
  notifyGatewayFailure: z.boolean(),
});

export type NotificationSettingsUpdateInput = z.infer<typeof notificationSettingsUpdateSchema>;
export type NotificationSettingsUpdateFormValues = NotificationSettingsUpdateInput;
