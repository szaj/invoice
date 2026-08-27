import { redirect } from "next/navigation";

import {
  OverdueAgingFilters,
  type OverdueAgingFilterValues,
} from "@/app/(app)/reports/overdue-aging/overdue-aging-filters";
import { ReportExportActions } from "@/app/(app)/reports/report-export-actions";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authorizePermission } from "@/domain/authz/authorize";
import { formatMoneyForDisplay } from "@/domain/money/format";
import { parseOverdueAgingSearchParams } from "@/domain/reporting/schema";
import type { OverdueAgingBucketSummary } from "@/domain/reporting/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadOverdueAgingForUi, loadOverdueAgingOptions } from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

function BucketCard({ bucket }: { bucket: OverdueAgingBucketSummary }) {
  return (
    <Card data-testid={`overdue-aging-bucket-${bucket.bucket}`}>
      <CardHeader>
        <CardTitle>{bucket.label}</CardTitle>
        <CardDescription>
          {bucket.invoiceCount === 0
            ? "No overdue invoices in this bucket"
            : `${bucket.invoiceCount} invoice(s)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {bucket.currencies.length === 0 ? (
          <p className="text-muted-foreground text-sm">—</p>
        ) : (
          <ul className="grid gap-2">
            {bucket.currencies.map((row) => (
              <li
                key={row.currencyCode}
                className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-sm tabular-nums"
              >
                <span>
                  {formatMoneyForDisplay(
                    row.outstandingAmount,
                    row.currencyCode,
                    row.decimalPrecision,
                  )}{" "}
                  <span className="text-muted-foreground">({row.currencyCode})</span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {row.invoiceCount} invoice{row.invoiceCount === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function OverdueAgingReportPage({
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
  const query = parseOverdueAgingSearchParams(params);
  const options = await loadOverdueAgingOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.data.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadOverdueAgingForUi(listQuery);

  const filterValues: OverdueAgingFilterValues = {
    companyId: companyId ?? "",
    customerId: query.customerId ?? "",
    staffUserId: query.staffUserId ?? "",
    reportingGroupId: query.reportingGroupId ?? "",
    invoiceCurrency: query.invoiceCurrency ?? "",
    countryCode: query.countryCode ?? "",
    complianceStatus: query.complianceStatus ?? "",
  };

  const totalInvoices = result.ok
    ? result.data.buckets.reduce((sum, bucket) => sum + bucket.invoiceCount, 0)
    : 0;

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Overdue aging"
        description="Past-due open balances in 1–30, 31–60, 61–90, and 90+ day buckets (BR-018). Amounts stay in original currency — no unlabeled mixed totals. Draft invoices are never aged."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Reports" },
          { label: "Overdue aging" },
        ]}
      />

      <OverdueAgingFilters
        initial={filterValues}
        companies={options.data.companies}
        reportingGroups={options.data.reportingGroups}
        allowsAllCompanies={options.data.allowsAllCompanies}
      />

      {canExport ? <ReportExportActions reportType="overdue-aging" filters={filterValues} /> : null}

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4" data-testid="overdue-aging-report">
          <p className="text-muted-foreground text-sm">
            As of {result.data.asOf} (UTC) · {totalInvoices} overdue invoice
            {totalInvoices === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {result.data.buckets.map((bucket) => (
              <BucketCard key={bucket.bucket} bucket={bucket} />
            ))}
          </div>
        </div>
      )}
    </PageFrame>
  );
}
