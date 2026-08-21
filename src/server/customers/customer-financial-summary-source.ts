import "server-only";

import type { CustomerFinancialSummaryInvoiceInput } from "@/domain/customers/financial-summary";

/**
 * Invoice/payment feed for customer financial summary (TASK-029 / TASK-038).
 * Production default is Prisma-backed; Empty remains for tests and unavailable modes.
 * Cancelled invoices must set `cancelled: true` (BR-019).
 * Do not invent rows or convert without stored rate snapshots.
 */
export interface CustomerFinancialSummarySource {
  /** False when invoice/payment modules are not yet wired. */
  readonly available: boolean;
  listInvoiceRowsForCustomer(input: {
    readonly customerId: string;
    readonly authorizedCompanyIds: readonly string[];
  }): Promise<readonly CustomerFinancialSummaryInvoiceInput[]>;
}

export class EmptyCustomerFinancialSummarySource implements CustomerFinancialSummarySource {
  readonly available = false;

  async listInvoiceRowsForCustomer(): Promise<readonly CustomerFinancialSummaryInvoiceInput[]> {
    return [];
  }
}
