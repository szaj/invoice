import { buildDashboardKpis } from "@/domain/reporting/dashboard-kpis";
import type {
  CompanyPerformanceRow,
  CompanyPerformanceSortDir,
  CompanyPerformanceSortField,
  CompanyPerformanceSourceInvoice,
  CompanyPerformanceSourcePayment,
} from "@/domain/reporting/types";

/**
 * Company Performance domain helpers (TASK-083 / §13.3 / BR-013).
 * Aggregates invoice and settlement KPIs by owning company.
 * Reporting-group filters only narrow company scope — they never become ownership.
 * Reuses dashboard KPI rules (collectible invoices, stored settlement snapshots, fees separate).
 */

type CompanyBucket = {
  companyId: string;
  companyDisplayName: string;
  invoices: CompanyPerformanceSourceInvoice[];
  payments: CompanyPerformanceSourcePayment[];
};

/**
 * Build one performance row per owning company from access-scoped source rows.
 * Ownership is always invoice/payment companyId — never reporting group.
 */
export function buildCompanyPerformanceRows(
  invoices: readonly CompanyPerformanceSourceInvoice[],
  payments: readonly CompanyPerformanceSourcePayment[],
  options: { readonly asOf?: Date } = {},
): CompanyPerformanceRow[] {
  const buckets = new Map<string, CompanyBucket>();

  function ensureBucket(companyId: string, companyDisplayName: string): CompanyBucket {
    let bucket = buckets.get(companyId);
    if (!bucket) {
      bucket = {
        companyId,
        companyDisplayName,
        invoices: [],
        payments: [],
      };
      buckets.set(companyId, bucket);
    } else if (companyDisplayName.length > 0 && bucket.companyDisplayName.length === 0) {
      bucket.companyDisplayName = companyDisplayName;
    }
    return bucket;
  }

  for (const invoice of invoices) {
    ensureBucket(invoice.companyId, invoice.companyDisplayName).invoices.push(invoice);
  }
  for (const payment of payments) {
    ensureBucket(payment.companyId, payment.companyDisplayName).payments.push(payment);
  }

  return [...buckets.values()].map((bucket) => {
    const kpis = buildDashboardKpis(bucket.invoices, bucket.payments, options);
    return {
      companyId: bucket.companyId,
      companyDisplayName: bucket.companyDisplayName,
      invoiceCurrencies: kpis.invoiceCurrencies,
      settlementCurrencies: kpis.settlementCurrencies,
      invoiceCount: bucket.invoices.length,
      paymentCount: bucket.payments.length,
    };
  });
}

/**
 * Sort company performance rows for report pagination.
 */
export function sortCompanyPerformanceRows(
  rows: readonly CompanyPerformanceRow[],
  sortBy: CompanyPerformanceSortField,
  sortDir: CompanyPerformanceSortDir,
): CompanyPerformanceRow[] {
  const dir = sortDir === "desc" ? -1 : 1;
  const sorted = [...rows];
  sorted.sort((left, right) => {
    let cmp = 0;
    switch (sortBy) {
      case "invoiceCount":
        cmp = left.invoiceCount - right.invoiceCount;
        break;
      case "paymentCount":
        cmp = left.paymentCount - right.paymentCount;
        break;
      case "company":
      default:
        cmp = left.companyDisplayName.localeCompare(right.companyDisplayName);
        break;
    }
    if (cmp !== 0) {
      return cmp * dir;
    }
    return left.companyDisplayName.localeCompare(right.companyDisplayName);
  });
  return sorted;
}

/**
 * Paginate already-sorted company performance rows.
 */
export function paginateCompanyPerformanceRows(
  rows: readonly CompanyPerformanceRow[],
  page: number,
  pageSize: number,
): { readonly rows: readonly CompanyPerformanceRow[]; readonly totalCount: number } {
  const totalCount = rows.length;
  const start = Math.max(0, (page - 1) * pageSize);
  return {
    rows: rows.slice(start, start + pageSize),
    totalCount,
  };
}

/**
 * BR-013: each company row must expose currency-scoped buckets only — no grandTotal.
 */
export function assertCompanyPerformanceHasNoUnlabeledMixedTotal(
  rows: readonly CompanyPerformanceRow[],
): void {
  if (!Array.isArray(rows)) {
    throw new Error("Company performance must expose company rows only.");
  }
  for (const row of rows) {
    if ("grandTotal" in row || "totalInvoiced" in row) {
      throw new Error("Company performance must not expose an unlabeled mixed-currency total.");
    }
    for (const bucket of row.invoiceCurrencies) {
      if (!bucket.currencyCode || String(bucket.currencyCode).trim().length === 0) {
        throw new Error("Company performance invoice bucket missing currency code.");
      }
    }
    for (const bucket of row.settlementCurrencies) {
      if (!bucket.currencyCode || String(bucket.currencyCode).trim().length === 0) {
        throw new Error("Company performance settlement bucket missing currency code.");
      }
    }
  }
}

/**
 * Ownership invariant: reporting group is never treated as the owning company.
 * Rows are keyed only by source companyId (transaction ownership).
 */
export function assertCompanyPerformanceOwnershipIsOriginalCompany(
  rows: readonly CompanyPerformanceRow[],
  sourceCompanyIds: readonly string[],
): void {
  const allowed = new Set(sourceCompanyIds);
  for (const row of rows) {
    if (!allowed.has(row.companyId)) {
      throw new Error("Company performance row ownership must match original company ids.");
    }
  }
}
