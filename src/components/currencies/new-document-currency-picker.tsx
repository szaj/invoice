"use client";

import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import {
  currenciesForNewDocumentPicker,
  type CurrencyPickerOption,
} from "@/domain/currencies/selection";

type NewDocumentCurrencyPickerProps = {
  readonly id?: string;
  readonly label?: string;
  readonly options: readonly CurrencyPickerOption[];
  /** Invoice headers store ISO codes; company config pickers may use currency IDs. */
  readonly valueMode?: "currencyId" | "code";
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly emptyMessage?: string;
};

/**
 * New-document currency picker (invoice/payment create).
 * Disabled (INACTIVE) currencies are never offered; use historical display helpers for old records.
 */
export function NewDocumentCurrencyPicker({
  id = "new-document-currency",
  label = "Currency",
  options,
  valueMode = "currencyId",
  value,
  onChange,
  disabled = false,
  required = false,
  emptyMessage = "No selectable currencies. Enable an active currency for this company first.",
}: NewDocumentCurrencyPickerProps) {
  const selectable = useMemo(() => currenciesForNewDocumentPicker(options), [options]);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {selectable.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      ) : (
        <select
          id={id}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          value={value ?? ""}
          disabled={disabled}
          required={required}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">{required ? "Select currency" : "None"}</option>
          {selectable.map((currency) => {
            const optionValue = valueMode === "code" ? currency.code : currency.currencyId;
            return (
              <option key={currency.currencyId} value={optionValue}>
                {currency.code} — {currency.name} ({currency.symbol})
              </option>
            );
          })}
        </select>
      )}
    </div>
  );
}
