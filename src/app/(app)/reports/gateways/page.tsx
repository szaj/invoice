import Link from "next/link";
import { redirect } from "next/navigation";

import {
  GatewayReportFilters,
  type GatewayReportFilterValues,
} from "@/app/(app)/reports/gateways/gateway-report-filters";
import { ReportExportActions } from "@/app/(app)/reports/report-export-actions";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { formatMoneyForDisplay } from "@/domain/money/format";
import {
  parseGatewayReportSearchParams,
  resolveGatewayReportQuery,
} from "@/domain/reporting/schema";
import type { GatewayReportRow } from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadGatewayReportForUi, loadGatewayReportOptions } from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

function toDateInputValue(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

function buildPageHref(base: GatewayReportFilterValues, page: number, pageSize: number): string {
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
  if (base.sortBy !== "gateway") {
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
  return query ? `/reports/gateways?${query}` : "/reports/gateways";
}

export default async function GatewayReportPage({
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
  const query = parseGatewayReportSearchParams(params);
  const resolved = resolveGatewayReportQuery(query);
  const options = await loadGatewayReportOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.data.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadGatewayReportForUi(listQuery);

  const filterValues: GatewayReportFilterValues = {
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

  const columns: DataTableColumn<GatewayReportRow>[] = [
    {
      id: "gateway",
      header: "Gateway",
      cell: (row) => <span className="text-foreground font-medium">{row.methodCode}</span>,
    },
    {
      id: "settlementCurrency",
      header: "Settlement currency",
      cell: (row) => (
        <span className="font-mono text-sm tabular-nums">{row.settlementCurrencyCode}</span>
      ),
    },
    {
      id: "transactionCount",
      header: "Transactions",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.transactionCount),
    },
    {
      id: "convertedSettlement",
      header: "Converted settlement",
      className: "font-mono tabular-nums",
      cell: (row) =>
        formatMoneyForDisplay(
          row.convertedSettlement,
          row.settlementCurrencyCode,
          row.settlementDecimalPrecision,
        ),
    },
    {
      id: "processorFees",
      header: "Fees (recon)",
      className: "font-mono tabular-nums",
      cell: (row) =>
        formatMoneyForDisplay(
          row.processorFees,
          row.settlementCurrencyCode,
          row.settlementDecimalPrecision,
        ),
    },
    {
      id: "actualReceived",
      header: "Actual received",
      className: "font-mono tabular-nums",
      cell: (row) =>
        formatMoneyForDisplay(
          row.actualReceived,
          row.settlementCurrencyCode,
          row.settlementDecimalPrecision,
        ),
    },
    {
      id: "failureCount",
      header: "Failures",
      className: "font-mono tabular-nums",
      cell: (row) => String(row.failureCount),
    },
    {
      id: "refunds",
      header: "Refunds",
      cell: (row) => (
        <span className="font-mono text-sm tabular-nums">
          {formatMoneyForDisplay(
            row.refunds,
            row.settlementCurrencyCode,
            row.settlementDecimalPrecision,
          )}{" "}
          <span className="text-muted-foreground font-sans">({row.refundCount})</span>
        </span>
      ),
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
        title="Gateway report"
        description="Transactions, converted settlement, optional fees and actual received, failures, and refunds by gateway and settlement currency. Fees are reconciliation-only and never deducted from settlement (BR-020)."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }, { label: "Gateways" }]}
      />

      <GatewayReportFilters
        initial={filterValues}
        companies={options.data.companies}
        reportingGroups={options.data.reportingGroups}
        allowsAllCompanies={options.data.allowsAllCompanies}
      />

      {canExport ? <ReportExportActions reportType="gateways" filters={filterValues} /> : null}

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <div data-testid="gateway-report">
          <DataTable
            columns={columns}
            rows={result.data.rows}
            rowKey={(row) => `${row.methodCode}:${row.settlementCurrencyCode}`}
            summary={`${result.data.totalCount} gateway row(s) · page ${currentPage} of ${totalPages} · sorted by ${result.data.sortBy} ${result.data.sortDir}`}
            emptyTitle="No gateway activity"
            emptyDescription="No payments or refunds match these filters for gateways you can access."
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
