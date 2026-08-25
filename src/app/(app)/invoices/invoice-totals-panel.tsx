"use client";

type InvoiceTotalsPanelProps = {
  readonly currencyCode: string;
  readonly subtotal: string;
  readonly discountTotal: string;
  readonly taxTotal: string;
  readonly invoiceTotal: string;
  readonly confirmedPaidAmount: string;
  readonly outstandingAmount: string;
};

/**
 * Display-only invoice totals panel (TASK-034).
 * Values must come from server-stored/recalculated totals — never client-authored money.
 */
export function InvoiceTotalsPanel({
  currencyCode,
  subtotal,
  discountTotal,
  taxTotal,
  invoiceTotal,
  confirmedPaidAmount,
  outstandingAmount,
}: InvoiceTotalsPanelProps) {
  const rows: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Subtotal", value: subtotal },
    {
      label: "Discount total",
      value: discountTotal,
      hint: "Always 0 while ADR-010 (discount model) remains OPEN.",
    },
    { label: "Tax total", value: taxTotal },
    { label: "Invoice total", value: invoiceTotal },
    {
      label: "Confirmed paid",
      value: confirmedPaidAmount,
      hint: "Sum of SUCCESSFUL payment applications in invoice currency (BR-009).",
    },
    { label: "Outstanding", value: outstandingAmount },
  ];

  return (
    <div className="grid gap-3">
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1">
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {row.label}
            </dt>
            <dd className="text-sm font-medium">
              {row.value} {currencyCode}
            </dd>
            {row.hint ? <p className="text-muted-foreground text-xs">{row.hint}</p> : null}
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-xs">
        Totals are server-calculated and display-only. Outstanding = invoice total − confirmed paid
        applications.
      </p>
    </div>
  );
}
