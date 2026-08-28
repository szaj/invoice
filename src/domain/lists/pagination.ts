export const LIST_DEFAULT_PAGE_SIZE = 50;
export const LIST_MAX_PAGE_SIZE = 100;
/** p95 budget for standard authenticated list/report pages under normal load (TASK-098). */
export const LIST_P95_BUDGET_MS = 2_000;

export const LIST_SORT_DIRS = ["asc", "desc"] as const;
export type ListSortDir = (typeof LIST_SORT_DIRS)[number];

export const INVOICE_LIST_SORT_FIELDS = [
  "updatedAt",
  "invoiceDate",
  "dueDate",
  "invoiceNumber",
  "status",
] as const;
export type InvoiceListSortField = (typeof INVOICE_LIST_SORT_FIELDS)[number];
export const INVOICE_LIST_DEFAULT_SORT_BY: InvoiceListSortField = "updatedAt";
export const INVOICE_LIST_DEFAULT_SORT_DIR: ListSortDir = "desc";

export const PAYMENT_LIST_SORT_FIELDS = ["paymentDate", "status", "createdAt"] as const;
export type PaymentListSortField = (typeof PAYMENT_LIST_SORT_FIELDS)[number];
export const PAYMENT_LIST_DEFAULT_SORT_BY: PaymentListSortField = "paymentDate";
export const PAYMENT_LIST_DEFAULT_SORT_DIR: ListSortDir = "desc";

export const CUSTOMER_LIST_SORT_FIELDS = ["displayName", "createdAt", "status"] as const;
export type CustomerListSortField = (typeof CUSTOMER_LIST_SORT_FIELDS)[number];
export const CUSTOMER_LIST_DEFAULT_SORT_BY: CustomerListSortField = "displayName";
export const CUSTOMER_LIST_DEFAULT_SORT_DIR: ListSortDir = "asc";

export type ListPage<T> = {
  readonly rows: readonly T[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
};

export type ResolvedListPagination = {
  readonly page: number;
  readonly pageSize: number;
  readonly skip: number;
};

/**
 * Clamp list page/pageSize. Interactive lists never return more than LIST_MAX_PAGE_SIZE rows.
 */
export function resolveListPagination(input?: {
  readonly page?: number;
  readonly pageSize?: number;
}): ResolvedListPagination {
  const page = Number.isFinite(input?.page) ? Math.max(1, Math.trunc(input!.page!)) : 1;
  const requested = Number.isFinite(input?.pageSize)
    ? Math.trunc(input!.pageSize!)
    : LIST_DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(LIST_MAX_PAGE_SIZE, Math.max(1, requested));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function paginateRows<T>(rows: readonly T[], page: number, pageSize: number): ListPage<T> {
  const start = Math.max(0, (page - 1) * pageSize);
  return {
    rows: rows.slice(start, start + pageSize),
    totalCount: rows.length,
    page,
    pageSize,
  };
}

export function listPageOf<T>(
  rows: readonly T[],
  totalCount: number,
  pagination: ResolvedListPagination,
): ListPage<T> {
  return {
    rows,
    totalCount,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}

export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}
