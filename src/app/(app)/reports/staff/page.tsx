import Link from "next/link";
import { redirect } from "next/navigation";

import {
  StaffPerformanceFilters,
  type StaffPerformanceFilterValues,
} from "@/app/(app)/reports/staff/staff-performance-filters";
import { ReportExportActions } from "@/app/(app)/reports/report-export-actions";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { formatMoneyForDisplay } from "@/domain/money/format";
import {
  parseStaffPerformanceSearchParams,
  resolveStaffPerformanceQuery,
} from "@/domain/reporting/schema";
import type { StaffPerformanceCurrencyAmount, StaffPerformanceRow } from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadStaffPerformanceForUi, loadStaffPerformanceOptions } from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

function toDateInputValue(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

function buildPageHref(base: StaffPerformanceFilterValues, page: number, pageSize: number): string {
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
  if (base.sortBy !== "staff") {
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
  return query ? `/reports/staff?${query}` : "/reports/staff";
}

function CurrencyAmountCell({ buckets }: { buckets: readonly StaffPerformanceCurrencyAmount[] }) {
  if (buckets.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <ul className="grid gap-1 text-sm">
      {buckets.map((bucket) => (
        <li key={bucket.currencyCode} className="font-mono tabular-nums">
          <span className="text-foreground font-sans font-medium">{bucket.currencyCode}</span>{" "}
          {formatMoneyForDisplay(bucket.amount, bucket.currencyCode, 2)}
        </li>
      ))}
    </ul>
  );
}

export default async function StaffPerformancePage({
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
  const query = parseStaffPerformanceSearchParams(params);
  const resolved = resolveStaffPerformanceQuery(query);
  const options = await loadStaffPerformanceOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.data.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadStaffPerformanceForUi(listQuery);

  const filterValues: StaffPerformanceFilterValues = {
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

  const columns: DataTableColumn<StaffPerformanceRow>[] = [
    {
      id: "staff",
      header: "Staff",
      cell: (row) => (
        <div className="grid gap-0.5">
          <span className="text-foreground font-medium">{row.staffDisplayName}</span>
          <span className="text-muted-foreground font-mono text-xs">
            {row.staffUserId.slice(0, 8)}
          </span>
        </div>
      ),
    },
    {
      id: "invoicesCreated",
      header: "Created",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.invoicesCreated),
    },
    {
      id: "invoicesSent",
      header: "Sent",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.invoicesSent),
    },
    {
      id: "valueInvoiced",
      header: "Value invoiced",
      cell: (row) => <CurrencyAmountCell buckets={row.valueInvoiced} />,
    },
    {
      id: "collections",
      header: "Collections (assigned)",
      cell: (row) => <CurrencyAmountCell buckets={row.collections} />,
    },
    {
      id: "collectionsCount",
      header: "Payments",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.collectionsCount),
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
        title="Staff performance"
        description="Invoices created/sent, value invoiced, and collections linked to assigned invoices. Commission is not calculated. Currencies stay separate (BR-013)."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }, { label: "Staff" }]}
      />

      <StaffPerformanceFilters
        initial={filterValues}
        companies={options.data.companies}
        reportingGroups={options.data.reportingGroups}
        allowsAllCompanies={options.data.allowsAllCompanies}
      />

      {canExport ? <ReportExportActions reportType="staff" filters={filterValues} /> : null}

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <div data-testid="staff-performance-report">
          <DataTable
            columns={columns}
            rows={result.data.rows}
            rowKey={(row) => row.staffUserId}
            summary={`${result.data.totalCount} staff row(s) · page ${currentPage} of ${totalPages} · sorted by ${result.data.sortBy} ${result.data.sortDir}`}
            emptyTitle="No staff performance"
            emptyDescription="No invoices or collections match these filters for staff you can access."
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
