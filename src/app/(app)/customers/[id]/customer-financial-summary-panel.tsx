import { formatMoneyForDisplay } from "@/domain/money/format";
import type { CustomerProfileFinancialSummary } from "@/domain/customers/profile";
import { MetricCard } from "@/components/layout/detail";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Currency-aware financial summary widgets (TASK-029 / BR-013).
 * Renders one block per invoice currency — never a single mixed-currency total.
 */
export function CustomerFinancialSummaryPanel({
  summary,
}: {
  summary: CustomerProfileFinancialSummary;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial summary</CardTitle>
        <CardDescription>{summary.message}</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.status === "empty" || summary.byCurrency.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {summary.status === "empty"
              ? "Totals will appear by currency when invoices and confirmed payments exist."
              : "No amounts for the selected companies."}
          </p>
        ) : (
          <div className="grid gap-4">
            {summary.byCurrency.map((bucket) => (
              <div key={bucket.currencyCode} className="grid gap-3">
                <p className="text-sm font-medium">{bucket.currencyCode}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric
                    label="Total invoiced"
                    amount={bucket.totalInvoiced}
                    currencyCode={bucket.currencyCode}
                  />
                  <Metric
                    label="Total paid"
                    amount={bucket.totalPaid}
                    currencyCode={bucket.currencyCode}
                  />
                  <Metric
                    label="Outstanding"
                    amount={bucket.outstanding}
                    currencyCode={bucket.currencyCode}
                  />
                  <Metric
                    label="Overdue"
                    amount={bucket.overdue}
                    currencyCode={bucket.currencyCode}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  amount,
  currencyCode,
}: {
  label: string;
  amount: string;
  currencyCode: string;
}) {
  const precision = amount.includes(".") ? (amount.split(".")[1]?.length ?? 2) : 0;
  return (
    <MetricCard label={label} value={formatMoneyForDisplay(amount, currencyCode, precision)} />
  );
}
