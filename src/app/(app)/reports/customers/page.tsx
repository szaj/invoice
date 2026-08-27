import Link from "next/link";
import { redirect } from "next/navigation";

import {
  CustomerReportFilters,
  type CustomerReportFilterValues,
} from "@/app/(app)/reports/customers/customer-report-filters";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { formatMoneyForDisplay } from "@/domain/money/format";
import {
  parseCustomerReportSearchParams,
  resolveCustomerReportQuery,
} from "@/domain/reporting/schema";
import type { CustomerReportRow } from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCustomerReportForUi, loadCustomerReportOptions } from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

function toDateInputValue(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

function buildPageHref(base: CustomerReportFilterValues, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  if (base.companyId) {
    params.set("companyId", base.companyId);
  }
  if (base.customerId) {
    params.set("customerId", base.customerId);
  }
  if (base.staffUserId) {
    params.set("staffUserId", base.staffUserId);
  }
  if (base.reportingGroupId) {
    params.set("reportingGroupId", base.reportingGroupId);
  }
  if (base.dateFrom) {
    params.set("dateFrom", base.dateFrom);
  }
  if (base.dateTo) {
    params.set("dateTo", base.dateTo);
  }
  if (base.invoiceStatus) {
    params.set("invoiceStatus", base.invoiceStatus);
  }
  if (base.invoiceCurrency) {
    params.set("invoiceCurrency", base.invoiceCurrency);
  }
  if (base.countryCode) {
    params.set("countryCode", base.countryCode);
  }
  if (base.complianceStatus) {
    params.set("complianceStatus", base.complianceStatus);
  }
  if (base.sortBy !== "customer") {
    params.set("sortBy", base.sortBy);
  }
  if (base.sortDir !== "asc") {
    params.set("sortDir", base.sortDir);
  }
  if (pageSize !== 50) {
    params.set("pageSize", String(pageSize));
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/reports/customers?${query}` : "/reports/customers";
}

export default async function CustomerReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed) {
    redirect("/");
  }

  const params = await searchParams;
  const query = parseCustomerReportSearchParams(params);
  const resolved = resolveCustomerReportQuery(query);
  const options = await loadCustomerReportOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.data.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadCustomerReportForUi(listQuery);

  const filterValues: CustomerReportFilterValues = {
    companyId: companyId ?? "",
    customerId: query.customerId ?? "",
    staffUserId: query.staffUserId ?? "",
    reportingGroupId: query.reportingGroupId ?? "",
    dateFrom: toDateInputValue(query.dateFrom),
    dateTo: toDateInputValue(query.dateTo),
    invoiceStatus: query.invoiceStatus ?? "",
    invoiceCurrency: query.invoiceCurrency ?? "",
    countryCode: query.countryCode ?? "",
    complianceStatus: query.complianceStatus ?? "",
    pageSize: String(resolved.pageSize),
    sortBy: resolved.sortBy,
    sortDir: resolved.sortDir,
  };

  const columns: DataTableColumn<CustomerReportRow>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: (row) => (
        <Link
          href={`/customers/${row.customerId}`}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {row.customerDisplayName}
        </Link>
      ),
    },
    {
      id: "currency",
      header: "Currency",
      className: "font-mono tabular-nums",
      cell: (row) => row.currencyCode,
    },
    {
      id: "invoiced",
      header: "Total invoiced",
      className: "font-mono tabular-nums",
      cell: (row) =>
        formatMoneyForDisplay(row.totalInvoiced, row.currencyCode, row.decimalPrecision),
    },
    {
      id: "paid",
      header: "Total paid",
      className: "font-mono tabular-nums",
      cell: (row) => formatMoneyForDisplay(row.totalPaid, row.currencyCode, row.decimalPrecision),
    },
    {
      id: "outstanding",
      header: "Outstanding",
      className: "font-mono tabular-nums",
      cell: (row) => formatMoneyForDisplay(row.outstanding, row.currencyCode, row.decimalPrecision),
    },
    {
      id: "invoiceCount",
      header: "Invoices",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.invoiceCount),
    },
  ];

  const totalPages =
    result.ok && result.data.pageSize > 0
      ? Math.max(1, Math.ceil(result.data.totalCount / result.data.pageSize))
      : 1;
  const currentPage = result.ok ? result.data.page : 1;
  const pageSize = result.ok ? result.data.pageSize : resolved.pageSize;

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Customer report"
        description="Total invoiced, paid, and outstanding by customer and invoice currency. Each currency stays separate — no unlabeled mixed totals (BR-013)."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }, { label: "Customers" }]}
      />

      <CustomerReportFilters
        initial={filterValues}
        companies={options.data.companies}
        reportingGroups={options.data.reportingGroups}
        allowsAllCompanies={options.data.allowsAllCompanies}
      />

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <div data-testid="customer-report">
          <DataTable
            columns={columns}
            rows={result.data.rows}
            rowKey={(row) => `${row.customerId}:${row.currencyCode}`}
            summary={`${result.data.totalCount} customer×currency row(s) · page ${currentPage} of ${totalPages} · sorted by ${result.data.sortBy} ${result.data.sortDir}`}
            emptyTitle="No customer totals"
            emptyDescription="No collectible invoices match these filters for companies you can access."
          />
          {result.data.totalCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {currentPage > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildPageHref(filterValues, currentPage - 1, pageSize)}>
                    Previous
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              )}
              {currentPage < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildPageHref(filterValues, currentPage + 1, pageSize)}>Next</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </PageFrame>
  );
}
