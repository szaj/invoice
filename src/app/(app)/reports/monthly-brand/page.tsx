import Link from "next/link";
import { redirect } from "next/navigation";

import { MonthlyBrandMatrixCell } from "@/app/(app)/reports/monthly-brand/monthly-brand-matrix-cell";
import {
  MonthlyBrandMatrixFilters,
  type MonthlyBrandMatrixFilterValues,
} from "@/app/(app)/reports/monthly-brand/monthly-brand-matrix-filters";
import { ReportExportActions } from "@/app/(app)/reports/report-export-actions";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authorizePermission } from "@/domain/authz/authorize";
import { formatMoneyForDisplay } from "@/domain/money/format";
import {
  parseMonthlyBrandMatrixSearchParams,
  resolveMonthlyBrandMatrixQuery,
} from "@/domain/reporting/schema";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  loadMonthlyBrandMatrixForUi,
  loadMonthlyBrandMatrixOptions,
} from "@/server/reporting/actions";

export const dynamic = "force-dynamic";

export default async function MonthlyBrandMatrixPage({
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
  const query = parseMonthlyBrandMatrixSearchParams(params);
  const resolved = resolveMonthlyBrandMatrixQuery(query);
  const options = await loadMonthlyBrandMatrixOptions(query.companyId);
  if (!options.ok) {
    redirect("/");
  }

  const companyId = query.companyId ?? options.data.defaultCompanyId ?? undefined;
  const listQuery = {
    ...query,
    ...(companyId ? { companyId } : {}),
  };

  const result = await loadMonthlyBrandMatrixForUi(listQuery);

  const filterValues: MonthlyBrandMatrixFilterValues = {
    year: String(resolved.year),
    companyId: companyId ?? "",
    customerId: query.customerId ?? "",
    staffUserId: query.staffUserId ?? "",
    reportingGroupId: query.reportingGroupId ?? "",
    paymentStatus: query.paymentStatus ?? "",
    paymentMethod: query.paymentMethod ?? "",
    invoiceCurrency: query.invoiceCurrency ?? "",
    settlementCurrency: query.settlementCurrency ?? "",
    countryCode: query.countryCode ?? "",
    complianceStatus: query.complianceStatus ?? "",
  };

  const currencyCode = result.ok ? result.data.reportingCurrencyCode : "USD";
  const decimalPrecision = result.ok ? result.data.decimalPrecision : 2;
  const currencyLabel = result.ok ? result.data.reportingCurrencyLabel : "reporting equivalent";

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Monthly brand / CB-RF report"
        description={`Spreadsheet-style gross receipts by brand and month in ${currencyLabel}. CB/RF uses payment received and adjustment effective dates (BR-024 / BR-026). Open disputes are shown separately.`}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Reports" },
          { label: "Monthly brand" },
        ]}
      />

      <MonthlyBrandMatrixFilters
        initial={filterValues}
        companies={options.data.companies}
        reportingGroups={options.data.reportingGroups}
        allowsAllCompanies={options.data.allowsAllCompanies}
      />

      {canExport ? <ReportExportActions reportType="monthly-brand" filters={filterValues} /> : null}

      {!result.ok ? (
        <Alert variant={result.status === 403 ? "destructive" : "default"}>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6" data-testid="monthly-brand-matrix-report">
          <section className="border-border bg-card grid gap-3 rounded-lg border p-4">
            <h2 className="text-foreground text-base font-medium">
              Annual summary ({result.data.year})
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground text-sm">Annual gross</dt>
                <dd className="font-mono tabular-nums">
                  {formatMoneyForDisplay(
                    result.data.summary.annualGross,
                    currencyCode,
                    decimalPrecision,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Annual CB/RF</dt>
                <dd className="font-mono tabular-nums">
                  {formatMoneyForDisplay(
                    result.data.summary.annualCbrf,
                    currencyCode,
                    decimalPrecision,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Net G.Total</dt>
                <dd className="font-mono tabular-nums">
                  {formatMoneyForDisplay(
                    result.data.summary.annualNetGTotal,
                    currencyCode,
                    decimalPrecision,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Open disputes (separate)</dt>
                <dd className="font-mono tabular-nums">
                  {formatMoneyForDisplay(
                    result.data.summary.openDisputes,
                    currencyCode,
                    decimalPrecision,
                  )}
                </dd>
              </div>
            </dl>
            {result.data.summary.currentMonthLabel ? (
              <div className="border-border border-t pt-3">
                <h3 className="text-foreground mb-2 text-sm font-medium">
                  Current month ({result.data.summary.currentMonthLabel})
                </h3>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground text-sm">Gross</dt>
                    <dd className="font-mono tabular-nums">
                      {formatMoneyForDisplay(
                        result.data.summary.currentMonthGross,
                        currencyCode,
                        decimalPrecision,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">CB/RF</dt>
                    <dd className="font-mono tabular-nums">
                      {formatMoneyForDisplay(
                        result.data.summary.currentMonthCbrf,
                        currencyCode,
                        decimalPrecision,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-sm">Net</dt>
                    <dd className="font-mono tabular-nums">
                      {formatMoneyForDisplay(
                        result.data.summary.currentMonthNet,
                        currencyCode,
                        decimalPrecision,
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
            {result.data.skippedConversionCount > 0 ? (
              <p className="text-muted-foreground text-sm">
                {result.data.skippedConversionCount} record(s) omitted — no Admin fixed rate for
                settlement → reporting conversion at transaction date.
              </p>
            ) : null}
          </section>

          <section className="grid gap-3">
            <h2 className="text-foreground text-base font-medium">
              Matrix · {currencyLabel} · payment received / effective date basis
            </h2>
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-border bg-muted/40 border-b">
                    <th className="text-muted-foreground bg-muted/95 sticky left-0 z-10 px-3 py-2 text-left font-medium">
                      Month
                    </th>
                    {result.data.companies.map((company) => (
                      <th
                        key={company.companyId}
                        className="text-muted-foreground px-3 py-2 text-right font-medium"
                      >
                        <Link
                          href={`/companies/${company.companyId}`}
                          className="text-foreground underline-offset-4 hover:underline"
                        >
                          {company.companyDisplayName}
                        </Link>
                      </th>
                    ))}
                    <th className="text-muted-foreground px-3 py-2 text-right font-medium">
                      Monthly Total
                    </th>
                    <th className="text-muted-foreground px-3 py-2 text-right font-medium">
                      CB/RF
                    </th>
                    <th className="text-muted-foreground px-3 py-2 text-right font-medium">
                      Net G.Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.rows.map((row) => (
                    <tr
                      key={row.rowKey}
                      className={
                        row.rowKey === "g-total"
                          ? "border-border bg-muted/20 border-t font-medium"
                          : "border-border border-b"
                      }
                    >
                      <td className="bg-card sticky left-0 z-10 px-3 py-2 font-medium">
                        {row.label}
                      </td>
                      {row.companies.map((cell) => (
                        <td key={cell.companyId} className="px-3 py-2 text-right">
                          <MonthlyBrandMatrixCell
                            amount={cell.grossReceipts}
                            currencyCode={currencyCode}
                            decimalPrecision={decimalPrecision}
                            drillDown={cell.drillDown}
                            label={`${row.label} gross`}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <MonthlyBrandMatrixCell
                          amount={row.monthlyTotal}
                          currencyCode={currencyCode}
                          decimalPrecision={decimalPrecision}
                          drillDown={row.drillDown}
                          label={`${row.label} monthly total`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <MonthlyBrandMatrixCell
                          amount={row.cbrf}
                          currencyCode={currencyCode}
                          decimalPrecision={decimalPrecision}
                          drillDown={{ paymentIds: [], adjustmentIds: row.drillDown.adjustmentIds }}
                          label={`${row.label} CB/RF`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatMoneyForDisplay(row.netGTotal, currencyCode, decimalPrecision)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </PageFrame>
  );
}
