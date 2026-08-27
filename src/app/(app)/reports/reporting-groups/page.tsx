import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ReportingGroupRollupFilters,
  type ReportingGroupRollupFilterValues,
} from "@/app/(app)/reports/reporting-groups/reporting-group-rollup-filters";
import { ReportExportActions } from "@/app/(app)/reports/report-export-actions";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authorizePermission } from "@/domain/authz/authorize";
import { formatMoneyForDisplay } from "@/domain/money/format";
import {
  parseReportingGroupRollupSearchParams,
  resolveReportingGroupRollupQuery,
} from "@/domain/reporting/schema";
import type {
  DashboardInvoiceCurrencyKpis,
  DashboardSettlementCurrencyKpis,
  ReportingGroupRollupRow,
} from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  loadReportingGroupRollupOptions,
  loadReportingGroupRollupsForUi,
} from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

function toDateInputValue(value: Date | undefined): string {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
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

function GroupMatrixSummary({
  row,
  year,
  currencyCode,
  currencyLabel,
  decimalPrecision,
}: {
  row: ReportingGroupRollupRow;
  year: number;
  currencyCode: string;
  currencyLabel: string;
  decimalPrecision: number;
}) {
  const summary = row.matrixSummary;
  if (!summary) {
    return null;
  }

  return (
    <section className="border-border bg-muted/20 grid gap-3 rounded-md border p-3">
      <h3 className="text-foreground text-sm font-medium">
        {year} matrix summary · {currencyLabel}
      </h3>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-sm">Annual gross</dt>
          <dd className="font-mono tabular-nums">
            {formatMoneyForDisplay(summary.annualGross, currencyCode, decimalPrecision)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Annual CB/RF</dt>
          <dd className="font-mono tabular-nums">
            {formatMoneyForDisplay(summary.annualCbrf, currencyCode, decimalPrecision)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Net G.Total</dt>
          <dd className="font-mono tabular-nums">
            {formatMoneyForDisplay(summary.annualNetGTotal, currencyCode, decimalPrecision)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Open disputes (separate)</dt>
          <dd className="font-mono tabular-nums">
            {formatMoneyForDisplay(summary.openDisputes, currencyCode, decimalPrecision)}
          </dd>
        </div>
      </dl>
      {summary.currentMonthLabel ? (
        <div className="border-border border-t pt-3">
          <h4 className="text-foreground mb-2 text-sm font-medium">
            Current month ({summary.currentMonthLabel})
          </h4>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-sm">Gross</dt>
              <dd className="font-mono tabular-nums">
                {formatMoneyForDisplay(summary.currentMonthGross, currencyCode, decimalPrecision)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">CB/RF</dt>
              <dd className="font-mono tabular-nums">
                {formatMoneyForDisplay(summary.currentMonthCbrf, currencyCode, decimalPrecision)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Net</dt>
              <dd className="font-mono tabular-nums">
                {formatMoneyForDisplay(summary.currentMonthNet, currencyCode, decimalPrecision)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      {summary.skippedConversionCount > 0 ? (
        <p className="text-muted-foreground text-sm">
          {summary.skippedConversionCount} record(s) omitted — no Admin fixed rate for settlement →
          reporting conversion at transaction date.
        </p>
      ) : null}
    </section>
  );
}

export default async function ReportingGroupRollupsPage({
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
  const query = parseReportingGroupRollupSearchParams(params);
  const resolved = resolveReportingGroupRollupQuery(query);
  const options = await loadReportingGroupRollupOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.data.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadReportingGroupRollupsForUi(listQuery);

  const filterValues: ReportingGroupRollupFilterValues = {
    year: String(resolved.year),
    reportingGroupId: query.reportingGroupId ?? "",
    companyId: companyId ?? "",
    customerId: query.customerId ?? "",
    staffUserId: query.staffUserId ?? "",
    dateFrom: toDateInputValue(query.dateFrom),
    dateTo: toDateInputValue(query.dateTo),
    invoiceStatus: query.invoiceStatus ?? "",
    paymentStatus: query.paymentStatus ?? "",
    invoiceCurrency: query.invoiceCurrency ?? "",
    settlementCurrency: query.settlementCurrency ?? "",
    countryCode: query.countryCode ?? "",
    complianceStatus: query.complianceStatus ?? "",
    paymentMethod: query.paymentMethod ?? "",
  };

  const currencyCode = result.ok ? result.data.reportingCurrencyCode : "USD";
  const decimalPrecision = result.ok ? result.data.decimalPrecision : 2;
  const currencyLabel = result.ok ? result.data.reportingCurrencyLabel : "reporting equivalent";

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Reporting group rollups"
        description="Dashboard KPIs and monthly-matrix summaries rolled up by reporting group. Transaction ownership stays on member companies — groups filter scope only (BR-013)."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Reports" },
          { label: "Reporting groups" },
        ]}
      />

      <ReportingGroupRollupFilters
        initial={filterValues}
        companies={options.data.companies}
        reportingGroups={options.data.reportingGroups}
        allowsAllCompanies={options.data.allowsAllCompanies}
      />

      {canExport ? (
        <ReportExportActions reportType="reporting-groups" filters={filterValues} />
      ) : null}

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6" data-testid="reporting-group-rollup-report">
          {result.data.rows.length === 0 ? (
            <Alert>
              <AlertDescription>
                No reporting groups match these filters for companies you can access. Companies
                without a reporting group appear in company performance, not here.
              </AlertDescription>
            </Alert>
          ) : (
            result.data.rows.map((row) => (
              <section
                key={row.reportingGroupId}
                className="border-border bg-card grid gap-4 rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-foreground text-base font-medium">
                      <Link
                        href={`/settings/reporting-groups/${row.reportingGroupId}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {row.reportingGroupName}
                      </Link>{" "}
                      <span className="text-muted-foreground font-normal">
                        ({row.reportingGroupCode})
                      </span>
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {row.companyCount} accessible member brand(s) in this rollup
                    </p>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {row.invoiceCount} invoice(s) · {row.paymentCount} payment(s)
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="text-foreground mb-2 text-sm font-medium">Invoice KPIs</h3>
                    <InvoiceKpiCell buckets={row.invoiceCurrencies} />
                  </div>
                  <div>
                    <h3 className="text-foreground mb-2 text-sm font-medium">Settlement KPIs</h3>
                    <SettlementKpiCell buckets={row.settlementCurrencies} />
                  </div>
                </div>

                <GroupMatrixSummary
                  row={row}
                  year={result.data.year}
                  currencyCode={currencyCode}
                  currencyLabel={currencyLabel}
                  decimalPrecision={decimalPrecision}
                />
              </section>
            ))
          )}
        </div>
      )}
    </PageFrame>
  );
}
