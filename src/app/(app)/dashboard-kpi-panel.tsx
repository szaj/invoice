import { formatMoneyForDisplay } from "@/domain/money/format";
import type { DashboardKpiPayload } from "@/domain/reporting/types";
import { MetricCard } from "@/components/layout/detail";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Dashboard KPI cards (TASK-077 / §13.1).
 * Renders by-currency buckets only — never one unlabeled mixed total (BR-013).
 * Fees and actual received are shown separately from converted settlement (BR-020).
 */
export function DashboardKpiPanel({ kpis }: { kpis: DashboardKpiPayload }) {
  const hasInvoiceAmounts = kpis.invoiceCurrencies.length > 0;
  const hasSettlementAmounts = kpis.settlementCurrencies.length > 0;
  const hasCounts =
    kpis.invoiceCountsByStatus.length > 0 || kpis.paymentCountsByMethodStatus.length > 0;

  if (!hasInvoiceAmounts && !hasSettlementAmounts && !hasCounts) {
    return (
      <Card data-testid="dashboard-kpis-empty">
        <CardHeader>
          <CardTitle>KPI summary</CardTitle>
          <CardDescription>
            Totals appear by currency when invoices and confirmed payments match the filters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No KPI data for the selected filters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4" data-testid="dashboard-kpis">
      {hasInvoiceAmounts ? (
        <Card>
          <CardHeader>
            <CardTitle>Invoice currency KPIs</CardTitle>
            <CardDescription>
              Original-currency totals only. Mixed currencies stay in separate buckets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {kpis.invoiceCurrencies.map((bucket) => (
                <div key={bucket.currencyCode} className="grid gap-3">
                  <p className="text-sm font-medium">{bucket.currencyCode}</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MoneyMetric
                      label="Total invoiced"
                      amount={bucket.totalInvoiced}
                      currencyCode={bucket.currencyCode}
                    />
                    <MoneyMetric
                      label="Total paid"
                      amount={bucket.totalPaid}
                      currencyCode={bucket.currencyCode}
                    />
                    <MoneyMetric
                      label="Outstanding"
                      amount={bucket.outstanding}
                      currencyCode={bucket.currencyCode}
                    />
                    <MoneyMetric
                      label="Overdue"
                      amount={bucket.overdue}
                      currencyCode={bucket.currencyCode}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasSettlementAmounts ? (
        <Card>
          <CardHeader>
            <CardTitle>Settlement KPIs</CardTitle>
            <CardDescription>
              Converted settlement uses stored Admin fixed-rate snapshots. Processor fees and actual
              received are reconciliation-only and are not deducted from settlement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {kpis.settlementCurrencies.map((bucket) => (
                <div key={bucket.currencyCode} className="grid gap-3">
                  <p className="text-sm font-medium">{bucket.currencyCode}</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <MoneyMetric
                      label="Converted settlement"
                      amount={bucket.convertedSettlement}
                      currencyCode={bucket.currencyCode}
                    />
                    <MoneyMetric
                      label="Processor / merchant fees"
                      amount={bucket.processorFees}
                      currencyCode={bucket.currencyCode}
                      hint="Displayed separately (BR-020)"
                    />
                    <MoneyMetric
                      label="Actual amount received"
                      amount={bucket.actualReceived}
                      currencyCode={bucket.currencyCode}
                      hint="Optional reconciliation field"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasCounts ? (
        <Card>
          <CardHeader>
            <CardTitle>Counts</CardTitle>
            <CardDescription>
              Invoice counts by status; payment counts by method and status.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <p className="text-sm font-medium">Invoices</p>
              {kpis.invoiceCountsByStatus.length === 0 ? (
                <p className="text-muted-foreground text-sm">None</p>
              ) : (
                <ul className="grid gap-1 text-sm">
                  {kpis.invoiceCountsByStatus.map((row) => (
                    <li key={row.status} className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{row.status}</span>
                      <span className="font-mono tabular-nums">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Payments</p>
              {kpis.paymentCountsByMethodStatus.length === 0 ? (
                <p className="text-muted-foreground text-sm">None</p>
              ) : (
                <ul className="grid gap-1 text-sm">
                  {kpis.paymentCountsByMethodStatus.map((row) => (
                    <li
                      key={`${row.methodCode}:${row.status}`}
                      className="flex justify-between gap-4"
                    >
                      <span className="text-muted-foreground">
                        {row.methodCode} · {row.status}
                      </span>
                      <span className="font-mono tabular-nums">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function MoneyMetric({
  label,
  amount,
  currencyCode,
  hint,
}: {
  label: string;
  amount: string;
  currencyCode: string;
  hint?: string;
}) {
  const precision = amount.includes(".") ? (amount.split(".")[1]?.length ?? 2) : 0;
  return (
    <MetricCard
      label={label}
      value={formatMoneyForDisplay(amount, currencyCode, precision)}
      hint={hint}
    />
  );
}
