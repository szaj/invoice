"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FixedConversionRateCreateFormValues } from "@/domain/fixed-rates/schema";
import { FIXED_RATE_FREQUENCIES } from "@/domain/fixed-rates/types";
import { createFixedConversionRateAction } from "@/server/fixed-rates/actions";

type CurrencyOption = {
  readonly code: string;
  readonly name: string;
  readonly status: string;
};

export function FixedRateCreateForm({
  currencies,
  defaultValues,
}: {
  currencies: readonly CurrencyOption[];
  defaultValues: FixedConversionRateCreateFormValues;
}) {
  const [values, setValues] = useState(defaultValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await createFixedConversionRateAction({
      fromCurrency: values.fromCurrency,
      toCurrency: values.toCurrency,
      fixedRate: values.fixedRate,
      frequencyLabel: values.frequencyLabel,
      validFrom: values.validFrom.includes("Z") ? values.validFrom : `${values.validFrom}:00.000Z`,
      validTo:
        values.validTo.trim() === ""
          ? null
          : values.validTo.includes("Z")
            ? values.validTo
            : `${values.validTo}:00.000Z`,
      notes: values.notes.trim() === "" ? null : values.notes,
    });

    if (result && !result.ok) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        Admin-defined fixed rates only. The application never fetches, guesses, or substitutes a
        market or gateway rate.
      </p>

      <div className="grid gap-2">
        <Label htmlFor="fromCurrency">From currency</Label>
        <select
          id="fromCurrency"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={values.fromCurrency}
          onChange={(event) =>
            setValues((current) => ({ ...current, fromCurrency: event.target.value }))
          }
          required
        >
          <option value="">Select currency</option>
          {currencies.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} — {currency.name}
              {currency.status === "INACTIVE" ? " (inactive)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="toCurrency">To currency</Label>
        <select
          id="toCurrency"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={values.toCurrency}
          onChange={(event) =>
            setValues((current) => ({ ...current, toCurrency: event.target.value }))
          }
          required
        >
          <option value="">Select currency</option>
          {currencies.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} — {currency.name}
              {currency.status === "INACTIVE" ? " (inactive)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="fixedRate">Fixed rate</Label>
        <Input
          id="fixedRate"
          value={values.fixedRate}
          onChange={(event) =>
            setValues((current) => ({ ...current, fixedRate: event.target.value }))
          }
          placeholder="3.670000000000"
          inputMode="decimal"
          required
        />
        <p className="text-muted-foreground text-xs">
          Up to 12 decimal places (NUMERIC 20,12). Stored as Decimal — not floating point.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="frequencyLabel">Frequency / label</Label>
        <select
          id="frequencyLabel"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={values.frequencyLabel}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              frequencyLabel: event.target
                .value as FixedConversionRateCreateFormValues["frequencyLabel"],
            }))
          }
          required
        >
          {FIXED_RATE_FREQUENCIES.map((frequency) => (
            <option key={frequency} value={frequency}>
              {frequency}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="validFrom">Valid from (UTC)</Label>
        <Input
          id="validFrom"
          type="datetime-local"
          value={values.validFrom}
          onChange={(event) =>
            setValues((current) => ({ ...current, validFrom: event.target.value }))
          }
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="validTo">Valid to (UTC, optional)</Label>
        <Input
          id="validTo"
          type="datetime-local"
          value={values.validTo}
          onChange={(event) =>
            setValues((current) => ({ ...current, validTo: event.target.value }))
          }
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          className="border-input bg-background min-h-24 rounded-md border px-3 py-2 text-sm"
          value={values.notes}
          onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
          maxLength={2000}
        />
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create new version"}
        </Button>
        <Link
          href="/settings/fixed-rates"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          Back to version history
        </Link>
      </div>
    </form>
  );
}
