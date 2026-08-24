import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { canViewInvoice } from "@/domain/invoices/access";
import type { InvoiceRecord } from "@/domain/invoices/types";
import type { PaymentRecord } from "@/domain/payments/types";

/**
 * Viewing a payment follows invoice visibility (Roles and Permissions).
 * Caller must still enforce company access. Staff without invoice.view_assigned
 * see only own/assigned invoices' payments.
 */
export function canViewPayment(
  actor: AuthorizationPrincipal,
  payment: Pick<PaymentRecord, "companyId">,
  invoice: Pick<InvoiceRecord, "createdByUserId" | "assignedStaffUserId" | "status" | "companyId">,
): boolean {
  if (payment.companyId !== invoice.companyId) {
    return false;
  }
  return canViewInvoice(actor, invoice);
}
