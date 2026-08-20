"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CompanyCurrencyConfiguration } from "@/domain/companies/company-currency-types";
import { updateCompanyCurrenciesAction } from "@/server/companies/company-currency-actions";

export function CompanyCurrencyForm({
  configuration,
}: {
  configuration: CompanyCurrencyConfiguration;
}) {
  const activeOptions = useMemo(
    () => configuration.currencies.filter((currency) => currency.globalStatus === "ACTIVE"),
    [configuration.currencies],
  );
  const inactiveAssigned = useMemo(
    () =>
      configuration.currencies.filter(
        (currency) => currency.globalStatus === "INACTIVE" && currency.enabled,
      ),
    [configuration.currencies],
  );

  const [enabledIds, setEnabledIds] = useState<string[]>([...configuration.enabledCurrencyIds]);
  const [defaultId, setDefaultId] = useState<string | null>(configuration.defaultCurrencyId);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleCurrency(currencyId: string, checked: boolean) {
    setEnabledIds((current) => {
      if (checked) {
        return current.includes(currencyId) ? current : [...current, currencyId];
      }
      const next = current.filter((id) => id !== currencyId);
      if (defaultId === currencyId) {
        setDefaultId(next[0] ?? null);
      }
      return next;
    });
    if (checked && defaultId === null) {
      setDefaultId(currencyId);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const result = await updateCompanyCurrenciesAction(configuration.companyId, {
      enabledCurrencyIds: enabledIds,
      defaultCurrencyId: enabledIds.length === 0 ? null : defaultId,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Saved.");
  }

  return (
    <form className="grid gap-6" onSubmit={onSubmit}>
      <div className="grid gap-3">
        <Label>Enabled invoice currencies</Label>
        <p className="text-muted-foreground text-xs">
          Only globally active currencies can be enabled. Settlement currencies are configured under
          Settlement on this company.
        </p>
        <div className="grid gap-2">
          {activeOptions.map((currency) => {
            const checked = enabledIds.includes(currency.currencyId);
            return (
              <label
                key={currency.currencyId}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggleCurrency(currency.currencyId, event.target.checked)}
                />
                <span className="font-medium">{currency.code}</span>
                <span className="text-muted-foreground">
                  {currency.name} ({currency.symbol})
                </span>
              </label>
            );
          })}
        </div>
        {inactiveAssigned.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Historically enabled but now globally inactive:{" "}
            {inactiveAssigned.map((currency) => currency.code).join(", ")}. They cannot be
            re-enabled until activated in the global catalog.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="defaultCurrencyId">Default invoice currency</Label>
        <select
          id="defaultCurrencyId"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          value={defaultId ?? ""}
          disabled={enabledIds.length === 0}
          onChange={(event) => setDefaultId(event.target.value || null)}
        >
          <option value="">None</option>
          {activeOptions
            .filter((currency) => enabledIds.includes(currency.currencyId))
            .map((currency) => (
              <option key={currency.currencyId} value={currency.currencyId}>
                {currency.code} — {currency.name}
              </option>
            ))}
        </select>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save currencies
        </Button>
        <Link
          href={`/companies/${configuration.companyId}`}
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          Back to company
        </Link>
      </div>
    </form>
  );
}
