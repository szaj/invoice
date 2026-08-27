import { redirect } from "next/navigation";

import {
  CurrencyReportFilters,
  type CurrencyReportFilterValues,
} from "@/app/(app)/reports/currencies/currency-report-filters";
import { ReportExportActions } from "@/app/(app)/reports/report-export-actions";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authorizePermission } from "@/domain/authz/authorize";
import { formatMoneyForDisplay } from "@/domain/money/format";
import {
  parseCurrencyReportSearchParams,
  resolveCurrencyReportQuery,
} from "@/domain/reporting/schema";
import type {
  CurrencyReportInvoiceRow,
  CurrencyReportSettlementRow,
} from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCurrencyReportForUi, loadCurrencyReportOptions } from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

function toDateInputValue(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

export default async function CurrencyReportPage({
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
  const query = parseCurrencyReportSearchParams(params);
  const resolved = resolveCurrencyReportQuery(query);
  const options = await loadCurrencyReportOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.data.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadCurrencyReportForUi(listQuery);

  const filterValues: CurrencyReportFilterValues = {
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
    sortBy: resolved.sortBy,
    sortDir: resolved.sortDir,
  };

  const invoiceColumns: DataTableColumn<CurrencyReportInvoiceRow>[] = [
    {
      id: "currency",
      header: "Invoice currency",
      cell: (row) => <span className="font-mono text-sm tabular-nums">{row.currencyCode}</span>,
    },
    {
      id: "totalInvoiced",
      header: "Total invoiced",
      className: "font-mono tabular-nums",
      cell: (row) => formatMoneyForDisplay(row.totalInvoiced, row.currencyCode, 2),
    },
    {
      id: "totalPaid",
      header: "Total paid",
      className: "font-mono tabular-nums",
      cell: (row) => formatMoneyForDisplay(row.totalPaid, row.currencyCode, 2),
    },
    {
      id: "outstanding",
      header: "Outstanding",
      className: "font-mono tabular-nums",
      cell: (row) => formatMoneyForDisplay(row.outstanding, row.currencyCode, 2),
    },
    {
      id: "overdue",
      header: "Overdue",
      className: "font-mono tabular-nums",
      cell: (row) => formatMoneyForDisplay(row.overdue, row.currencyCode, 2),
    },
  ];

  const settlementColumns: DataTableColumn<CurrencyReportSettlementRow>[] = [
    {
      id: "currency",
      header: "Settlement currency",
      cell: (row) => <span className="font-mono text-sm tabular-nums">{row.currencyCode}</span>,
    },
    {
      id: "convertedSettlement",
      header: "Converted settlement",
      className: "font-mono tabular-nums",
      cell: (row) => formatMoneyForDisplay(row.convertedSettlement, row.currencyCode, 2),
    },
    {
      id: "processorFees",
      header: "Fees (recon)",
      className: "font-mono tabular-nums",
      cell: (row) => formatMoneyForDisplay(row.processorFees, row.currencyCode, 2),
    },
    {
      id: "actualReceived",
      header: "Actual received",
      className: "font-mono tabular-nums",
      cell: (row) => formatMoneyForDisplay(row.actualReceived, row.currencyCode, 2),
    },
  ];

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Currency report"
        description="Invoice totals by invoice currency and settlement totals by settlement currency. Currencies stay labeled and separate (BR-013). Fees are reconciliation-only and never deducted from settlement (BR-020)."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }, { label: "Currencies" }]}
      />

      <CurrencyReportFilters
        initial={filterValues}
        companies={options.data.companies}
        reportingGroups={options.data.reportingGroups}
        allowsAllCompanies={options.data.allowsAllCompanies}
      />

      {canExport ? <ReportExportActions reportType="currencies" filters={filterValues} /> : null}

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-8" data-testid="currency-report">
          <section className="grid gap-3" data-testid="currency-report-invoice-totals">
            <h2 className="text-foreground text-base font-medium">Invoice currency totals</h2>
            <DataTable
              columns={invoiceColumns}
              rows={result.data.invoiceCurrencies}
              rowKey={(row) => row.currencyCode}
              summary={`${result.data.invoiceCurrencies.length} invoice currency row(s) · sorted by ${result.data.sortBy} ${result.data.sortDir}`}
              emptyTitle="No invoice currency totals"
              emptyDescription="No collectible invoices match these filters for currencies you can access."
            />
          </section>

          <section className="grid gap-3" data-testid="currency-report-settlement-totals">
            <h2 className="text-foreground text-base font-medium">Settlement currency totals</h2>
            <DataTable
              columns={settlementColumns}
              rows={result.data.settlementCurrencies}
              rowKey={(row) => row.currencyCode}
              summary={`${result.data.settlementCurrencies.length} settlement currency row(s) · sorted by ${result.data.sortBy} ${result.data.sortDir}`}
              emptyTitle="No settlement currency totals"
              emptyDescription="No confirmed payments match these filters for settlement currencies you can access."
            />
          </section>
        </div>
      )}
    </PageFrame>
  );
}
