"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeInvoiceLineTotal } from "@/domain/invoices/line-items";
import { replaceDraftInvoiceLineItemsAction } from "@/server/invoices/actions";

type LineDraft = {
  key: string;
  description: string;
  quantity: string;
  unitRate: string;
  taxName: string;
  taxRatePercent: string;
};

type SavedLine = {
  id: string;
  description: string;
  quantity: string;
  unitRate: string;
  taxName: string | null;
  taxRatePercent: string | null;
  lineTotal: string;
};

function newLine(): LineDraft {
  return {
    key: `new-${Math.random().toString(36).slice(2)}`,
    description: "",
    quantity: "1",
    unitRate: "0.00",
    taxName: "",
    taxRatePercent: "",
  };
}

export function InvoiceLineItemsEditor({
  invoiceId,
  currencyCode,
  decimalPrecision,
  initialItems,
  readOnly = false,
}: {
  invoiceId: string;
  currencyCode: string;
  decimalPrecision: number;
  initialItems: readonly SavedLine[];
  readOnly?: boolean;
}) {
  const [rows, setRows] = useState<LineDraft[]>(
    initialItems.length > 0
      ? initialItems.map((item) => ({
          key: item.id,
          description: item.description,
          quantity: item.quantity,
          unitRate: item.unitRate,
          taxName: item.taxName ?? "",
          taxRatePercent: item.taxRatePercent ?? "",
        }))
      : [newLine()],
  );
  const [savedTotals, setSavedTotals] = useState(
    initialItems.map((item) => ({ key: item.id, lineTotal: item.lineTotal })),
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const previewTotals = useMemo(() => {
    return rows.map((row) => {
      try {
        return computeInvoiceLineTotal({
          quantity: row.quantity || "0",
          unitRate: row.unitRate || "0",
          decimalPrecision,
        });
      } catch {
        return "—";
      }
    });
  }, [rows, decimalPrecision]);

  async function onSave() {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const payload = {
        lineItems: rows.map((row) => ({
          description: row.description,
          quantity: row.quantity,
          unitRate: row.unitRate,
          taxName: row.taxName,
          taxRatePercent: row.taxRatePercent,
        })),
      };
      const result = await replaceDraftInvoiceLineItemsAction(invoiceId, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Line items saved.");
      // Refresh preview keys from current rows; authoritative totals reload on navigation.
      setSavedTotals(
        rows.map((row, index) => ({
          key: row.key,
          lineTotal: previewTotals[index] ?? "—",
        })),
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (readOnly) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-3 font-medium">Description</th>
              <th className="py-2 pr-3 font-medium">Qty</th>
              <th className="py-2 pr-3 font-medium">Unit rate ({currencyCode})</th>
              <th className="py-2 pr-3 font-medium">Tax snapshot</th>
              <th className="py-2 font-medium">Line total</th>
            </tr>
          </thead>
          <tbody>
            {initialItems.length === 0 ? (
              <tr>
                <td className="text-muted-foreground py-4" colSpan={5}>
                  No line items.
                </td>
              </tr>
            ) : (
              initialItems.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{item.description}</td>
                  <td className="py-2 pr-3">{item.quantity}</td>
                  <td className="py-2 pr-3">{item.unitRate}</td>
                  <td className="py-2 pr-3">
                    {item.taxName || item.taxRatePercent
                      ? `${item.taxName ?? "Tax"}${item.taxRatePercent ? ` ${item.taxRatePercent}%` : ""}`
                      : "—"}
                  </td>
                  <td className="py-2">
                    {item.lineTotal} {currencyCode}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="text-muted-foreground mt-2 text-xs">
          Line totals are server-calculated. Invoice subtotal/tax/total panels are TASK-034.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {rows.map((row, index) => (
        <div key={row.key} className="border-border grid gap-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Line {index + 1}</p>
            {rows.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`line-desc-${row.key}`}>Description</Label>
            <Input
              id={`line-desc-${row.key}`}
              value={row.description}
              onChange={(event) =>
                setRows((current) =>
                  current.map((item) =>
                    item.key === row.key ? { ...item, description: event.target.value } : item,
                  ),
                )
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor={`line-qty-${row.key}`}>Quantity</Label>
              <Input
                id={`line-qty-${row.key}`}
                value={row.quantity}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item) =>
                      item.key === row.key ? { ...item, quantity: event.target.value } : item,
                    ),
                  )
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`line-rate-${row.key}`}>Unit rate ({currencyCode})</Label>
              <Input
                id={`line-rate-${row.key}`}
                value={row.unitRate}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item) =>
                      item.key === row.key ? { ...item, unitRate: event.target.value } : item,
                    ),
                  )
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Line total (preview)</Label>
              <p className="border-input bg-muted/30 flex h-10 items-center rounded-md border px-3 text-sm">
                {previewTotals[index]} {currencyCode}
              </p>
              <p className="text-muted-foreground text-xs">
                Display-only preview. Saved total is server-calculated.
                {savedTotals.find((saved) => saved.key === row.key)
                  ? ` Last saved: ${savedTotals.find((saved) => saved.key === row.key)?.lineTotal}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`line-tax-name-${row.key}`}>Tax name (optional snapshot)</Label>
              <Input
                id={`line-tax-name-${row.key}`}
                value={row.taxName}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item) =>
                      item.key === row.key ? { ...item, taxName: event.target.value } : item,
                    ),
                  )
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`line-tax-rate-${row.key}`}>Tax rate % (optional snapshot)</Label>
              <Input
                id={`line-tax-rate-${row.key}`}
                value={row.taxRatePercent}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item) =>
                      item.key === row.key ? { ...item, taxRatePercent: event.target.value } : item,
                    ),
                  )
                }
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Discounts are blocked until ADR-010 is accepted. Tax snapshots are stored for later
            totals (TASK-034); they do not change line total yet.
          </p>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((current) => [...current, newLine()])}
        >
          Add line
        </Button>
        <Button type="button" disabled={pending} onClick={() => void onSave()}>
          Save line items
        </Button>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
    </div>
  );
}
