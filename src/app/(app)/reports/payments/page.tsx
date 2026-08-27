import Link from "next/link";
import { redirect } from "next/navigation";

import {
  PaymentReportFilters,
  type PaymentReportFilterValues,
} from "@/app/(app)/reports/payments/payment-report-filters";
import { DataTable, type DataTableColumn } from "@/components/data/data-table";
import { StatusBadge } from "@/components/data/status-badge";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { formatMoneyForDisplay } from "@/domain/money/format";
import {
  parsePaymentReportSearchParams,
  resolvePaymentReportQuery,
} from "@/domain/reporting/schema";
import type { PaymentReportRow } from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadPaymentReportForUi, loadPaymentReportOptions } from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

function toDateInputValue(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

function buildPageHref(base: PaymentReportFilterValues, page: number, pageSize: number): string {
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
  if (base.sortBy !== "date") {
    params.set("sortBy", base.sortBy);
  }
  if (base.sortDir !== "desc") {
    params.set("sortDir", base.sortDir);
  }
  if (pageSize !== 50) {
    params.set("pageSize", String(pageSize));
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/reports/payments?${query}` : "/reports/payments";
}

export default async function PaymentReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "report.view").allowed) {
    redirect("/");
  }

  const params = await searchParams;
  const query = parsePaymentReportSearchParams(params);
  const resolved = resolvePaymentReportQuery(query);
  const options = await loadPaymentReportOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.data.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadPaymentReportForUi(listQuery);

  const filterValues: PaymentReportFilterValues = {
    companyId: companyId ?? "",
    customerId: query.customerId ?? "",
    staffUserId: query.staffUserId ?? "",
    reportingGroupId: query.reportingGroupId ?? "",
    dateFrom: toDateInputValue(query.dateFrom),
    dateTo: toDateInputValue(query.dateTo),
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

  const columns: DataTableColumn<PaymentReportRow>[] = [
    {
      id: "invoice",
      header: "Invoice",
      cell: (row) => (
        <Link
          href={`/invoices/${row.invoiceId}`}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {row.invoiceNumber ?? `Draft ${row.invoiceId.slice(0, 8)}`}
        </Link>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      cell: (row) => (
        <Link
          href={`/customers/${row.customerId}`}
          className="text-foreground underline-offset-4 hover:underline"
        >
          {row.customerDisplayName}
        </Link>
      ),
    },
    {
      id: "method",
      header: "Method",
      cell: (row) => row.methodCode,
    },
    {
      id: "transactionId",
      header: "Transaction ID",
      className: "max-w-[12rem] truncate font-mono text-xs",
      cell: (row) => row.externalTransactionId ?? "—",
    },
    {
      id: "applied",
      header: "Applied",
      className: "font-mono tabular-nums",
      cell: (row) =>
        formatMoneyForDisplay(
          row.invoiceAmountApplied,
          row.invoiceCurrencyCode,
          row.invoiceDecimalPrecision,
        ),
    },
    {
      id: "rate",
      header: "Fixed rate",
      className: "font-mono tabular-nums text-xs",
      cell: (row) => row.fixedConversionRate,
    },
    {
      id: "settlement",
      header: "Converted settlement",
      className: "font-mono tabular-nums",
      cell: (row) =>
        formatMoneyForDisplay(
          row.convertedSettlementAmount,
          row.settlementCurrencyCode,
          row.settlementDecimalPrecision,
        ),
    },
    {
      id: "fee",
      header: "Fee",
      className: "font-mono tabular-nums",
      cell: (row) =>
        row.processorFeeAmount == null
          ? "—"
          : formatMoneyForDisplay(
              row.processorFeeAmount,
              row.settlementCurrencyCode,
              row.settlementDecimalPrecision,
            ),
    },
    {
      id: "actualReceived",
      header: "Actual received",
      className: "font-mono tabular-nums",
      cell: (row) =>
        row.actualReceivedAmount == null
          ? "—"
          : formatMoneyForDisplay(
              row.actualReceivedAmount,
              row.settlementCurrencyCode,
              row.settlementDecimalPrecision,
            ),
    },
    {
      id: "currency",
      header: "Settlement currency",
      className: "font-mono tabular-nums",
      cell: (row) => row.settlementCurrencyCode,
    },
    {
      id: "date",
      header: "Date",
      className: "whitespace-nowrap font-mono text-xs",
      cell: (row) => row.paymentDate,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
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
        title="Payment report"
        description="Invoice, customer, method, transaction ID, applied amount, stored fixed-rate snapshot, converted settlement, optional fee and actual received, currency, date, and status. Settlement uses locked snapshots only — never live rates. Fees are reconciliation-only."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports" }, { label: "Payments" }]}
      />

      <PaymentReportFilters
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
        <>
          <DataTable
            columns={columns}
            rows={result.data.rows}
            rowKey={(row) => row.id}
            summary={`${result.data.totalCount} payment(s) · page ${currentPage} of ${totalPages} · sorted by ${result.data.sortBy} ${result.data.sortDir}`}
            emptyTitle="No payments"
            emptyDescription="No payments match these filters for companies you can access."
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
        </>
      )}
    </PageFrame>
  );
}
