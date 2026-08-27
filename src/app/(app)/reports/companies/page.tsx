import Link from "next/link";
import { redirect } from "next/navigation";

import {
  CompanyPerformanceFilters,
  type CompanyPerformanceFilterValues,
} from "@/app/(app)/reports/companies/company-performance-filters";
import { ReportExportActions } from "@/app/(app)/reports/report-export-actions";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { formatMoneyForDisplay } from "@/domain/money/format";
import {
  parseCompanyPerformanceSearchParams,
  resolveCompanyPerformanceQuery,
} from "@/domain/reporting/schema";
import type {
  CompanyPerformanceRow,
  DashboardInvoiceCurrencyKpis,
  DashboardSettlementCurrencyKpis,
} from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  loadCompanyPerformanceForUi,
  loadCompanyPerformanceOptions,
} from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

function toDateInputValue(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

function buildPageHref(
  base: CompanyPerformanceFilterValues,
  page: number,
  pageSize: number,
): string {
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
  if (base.paymentStatus) {
    params.set("paymentStatus", base.paymentStatus);
  }
  if (base.paymentMethod) {
    params.set("paymentMethod", base.paymentMethod);
  }
  if (base.invoiceCurrency) {
    params.set("invoiceCurrency", base.invoiceCurrency);
  }
  if (base.settlementCurrency) {
    params.set("settlementCurrency", base.settlementCurrency);
  }
  if (base.countryCode) {
    params.set("countryCode", base.countryCode);
  }
  if (base.complianceStatus) {
    params.set("complianceStatus", base.complianceStatus);
  }
  if (base.sortBy !== "company") {
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
  return query ? `/reports/companies?${query}` : "/reports/companies";
}

function InvoiceKpiCell({ buckets }: { buckets: readonly DashboardInvoiceCurrencyKpis[] }) {
  if (buckets.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <ul className="grid gap-1 text-sm">
      {buckets.map((bucket) => (
        <li key={bucket.currencyCode} className="font-mono tabular-nums">
          <span className="text-foreground font-sans font-medium">{bucket.currencyCode}</span> inv{" "}
          {formatMoneyForDisplay(bucket.totalInvoiced, bucket.currencyCode, 2)} · paid{" "}
          {formatMoneyForDisplay(bucket.totalPaid, bucket.currencyCode, 2)} · out{" "}
          {formatMoneyForDisplay(bucket.outstanding, bucket.currencyCode, 2)} · od{" "}
          {formatMoneyForDisplay(bucket.overdue, bucket.currencyCode, 2)}
        </li>
      ))}
    </ul>
  );
}

function SettlementKpiCell({ buckets }: { buckets: readonly DashboardSettlementCurrencyKpis[] }) {
  if (buckets.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <ul className="grid gap-1 text-sm">
      {buckets.map((bucket) => (
        <li key={bucket.currencyCode} className="font-mono tabular-nums">
          <span className="text-foreground font-sans font-medium">{bucket.currencyCode}</span> setl{" "}
          {formatMoneyForDisplay(bucket.convertedSettlement, bucket.currencyCode, 2)} · fees{" "}
          {formatMoneyForDisplay(bucket.processorFees, bucket.currencyCode, 2)} · recv{" "}
          {formatMoneyForDisplay(bucket.actualReceived, bucket.currencyCode, 2)}
        </li>
      ))}
    </ul>
  );
}

export default async function CompanyPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed) {
    redirect("/");
  }
  const canExport = authorizePermission(actor, "report.export").allowed;

  const params = await searchParams;
  const query = parseCompanyPerformanceSearchParams(params);
  const resolved = resolveCompanyPerformanceQuery(query);
  const options = await loadCompanyPerformanceOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.data.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadCompanyPerformanceForUi(listQuery);

  const filterValues: CompanyPerformanceFilterValues = {
    companyId: companyId ?? "",
    customerId: query.customerId ?? "",
    staffUserId: query.staffUserId ?? "",
    reportingGroupId: query.reportingGroupId ?? "",
    dateFrom: toDateInputValue(query.dateFrom),
    dateTo: toDateInputValue(query.dateTo),
    invoiceStatus: query.invoiceStatus ?? "",
    paymentStatus: query.paymentStatus ?? "",
    paymentMethod: query.paymentMethod ?? "",
    invoiceCurrency: query.invoiceCurrency ?? "",
    settlementCurrency: query.settlementCurrency ?? "",
    countryCode: query.countryCode ?? "",
    complianceStatus: query.complianceStatus ?? "",
    pageSize: String(resolved.pageSize),
    sortBy: resolved.sortBy,
    sortDir: resolved.sortDir,
  };

  const columns: DataTableColumn<CompanyPerformanceRow>[] = [
    {
      id: "company",
      header: "Company",
      cell: (row) => (
        <Link
          href={`/companies/${row.companyId}`}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {row.companyDisplayName}
        </Link>
      ),
    },
    {
      id: "invoiceKpis",
      header: "Invoice KPIs",
      cell: (row) => <InvoiceKpiCell buckets={row.invoiceCurrencies} />,
    },
    {
      id: "settlementKpis",
      header: "Settlement KPIs",
      cell: (row) => <SettlementKpiCell buckets={row.settlementCurrencies} />,
    },
    {
      id: "invoiceCount",
      header: "Invoices",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.invoiceCount),
    },
    {
      id: "paymentCount",
      header: "Payments",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.paymentCount),
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
        title="Company performance"
        description="Invoice and settlement KPIs by owning company. Reporting groups filter scope only — ownership stays on the original company. Currencies stay separate (BR-013)."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }, { label: "Companies" }]}
      />

      <CompanyPerformanceFilters
        initial={filterValues}
        companies={options.data.companies}
        reportingGroups={options.data.reportingGroups}
        allowsAllCompanies={options.data.allowsAllCompanies}
      />

      {canExport ? <ReportExportActions reportType="companies" filters={filterValues} /> : null}

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <div data-testid="company-performance-report">
          <DataTable
            columns={columns}
            rows={result.data.rows}
            rowKey={(row) => row.companyId}
            summary={`${result.data.totalCount} company row(s) · page ${currentPage} of ${totalPages} · sorted by ${result.data.sortBy} ${result.data.sortDir}`}
            emptyTitle="No company performance"
            emptyDescription="No invoices or payments match these filters for companies you can access."
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
