"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatMoneyForDisplay } from "@/domain/money/format";
import type { MonthlyBrandMatrixDrillDown } from "@/domain/reporting/types";

export function MonthlyBrandMatrixCell({
  amount,
  currencyCode,
  decimalPrecision,
  drillDown,
  label,
}: {
  amount: string;
  currencyCode: string;
  decimalPrecision: number;
  drillDown: MonthlyBrandMatrixDrillDown;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const hasDrillDown = drillDown.paymentIds.length > 0 || drillDown.adjustmentIds.length > 0;
  const formatted = formatMoneyForDisplay(amount, currencyCode, decimalPrecision);

  if (!hasDrillDown) {
    return <span className="font-mono tabular-nums">{formatted}</span>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="text-foreground hover:text-primary font-mono tabular-nums underline-offset-4 hover:underline"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`${label} drill-down`}
      >
        {formatted}
      </button>
      {open ? (
        <div className="border-border bg-popover absolute z-20 mt-1 min-w-48 rounded-md border p-3 shadow-md">
          <p className="text-muted-foreground mb-2 text-xs font-medium">Drill-down</p>
          <ul className="grid max-h-40 gap-1 overflow-y-auto text-sm">
            {drillDown.paymentIds.map((paymentId) => (
              <li key={`payment-${paymentId}`}>
                <Link
                  href={`/payments/${paymentId}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Payment {paymentId.slice(0, 8)}…
                </Link>
              </li>
            ))}
            {drillDown.adjustmentIds.map((adjustmentId) => (
              <li key={`adjustment-${adjustmentId}`}>
                <span className="text-muted-foreground font-mono text-xs">{adjustmentId}</span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-7 px-2"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
        </div>
      ) : null}
    </div>
  );
}
