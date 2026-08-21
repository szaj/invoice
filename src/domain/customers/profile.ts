/**
 * Customer profile financial summary presentation (TASK-029).
 * Invoice source is wired (TASK-030+); status is `ready` with per-currency buckets
 * (possibly empty when the customer has no invoices). `empty` remains when no source is available.
 */

import type { CustomerFinancialSummaryCurrencyBucket } from "@/domain/customers/financial-summary";
import type { CustomerNoteRecord } from "@/domain/customers/notes";
import type { CustomerRecord } from "@/domain/customers/types";

export type CustomerProfileCompany = {
  readonly id: string;
  readonly displayName: string;
};

export type CustomerProfilePlaceholderSection = {
  readonly status: "placeholder";
  readonly message: string;
  readonly items: readonly [];
};

export type CustomerProfileFinancialSummary =
  | {
      readonly status: "empty";
      readonly message: string;
      readonly byCurrency: readonly [];
      /** No invoice/payment source rows yet (Phase 04+). */
      readonly sourceAvailable: false;
    }
  | {
      readonly status: "ready";
      readonly message: string;
      readonly byCurrency: readonly CustomerFinancialSummaryCurrencyBucket[];
      readonly sourceAvailable: true;
    };

export type CustomerProfileActivityItem = {
  readonly id: string;
  readonly occurredAt: Date;
  readonly action: string;
  readonly companyId: string | null;
  readonly actorUserId: string | null;
};

export type CustomerProfileNotesSection = {
  readonly status: "ready";
  readonly internalOnly: true;
  readonly items: readonly CustomerNoteRecord[];
};

export type CustomerProfile = {
  readonly customer: CustomerRecord;
  readonly companies: readonly CustomerProfileCompany[];
  readonly companyFilterId: string | null;
  readonly financialSummary: CustomerProfileFinancialSummary;
  readonly invoices: CustomerProfilePlaceholderSection;
  readonly payments: CustomerProfilePlaceholderSection;
  readonly notes: CustomerProfileNotesSection;
  readonly activity: {
    readonly items: readonly CustomerProfileActivityItem[];
  };
};

export const PROFILE_FINANCIAL_EMPTY =
  "No invoice or payment totals yet. When invoices exist, amounts appear by currency. Mixed currencies are never summed into one unlabeled amount.";
export const PROFILE_FINANCIAL_READY =
  "Amounts are shown per invoice currency. Mixed currencies are never combined into one unlabeled total.";
export const PROFILE_INVOICES_PLACEHOLDER = "Invoice history is not available yet.";
export const PROFILE_PAYMENTS_PLACEHOLDER = "Payment history is not available yet.";

/** @deprecated Use PROFILE_FINANCIAL_EMPTY */
export const PROFILE_FINANCIAL_PLACEHOLDER = PROFILE_FINANCIAL_EMPTY;

export function toProfileFinancialSummary(
  byCurrency: readonly CustomerFinancialSummaryCurrencyBucket[],
  sourceAvailable: boolean,
): CustomerProfileFinancialSummary {
  if (!sourceAvailable) {
    return {
      status: "empty",
      message: PROFILE_FINANCIAL_EMPTY,
      byCurrency: [],
      sourceAvailable: false,
    };
  }
  return {
    status: "ready",
    message: PROFILE_FINANCIAL_READY,
    byCurrency,
    sourceAvailable: true,
  };
}
