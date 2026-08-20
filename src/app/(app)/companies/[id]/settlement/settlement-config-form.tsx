"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  INITIAL_SETTLEMENT_CURRENCY_CODES,
  type CompanySettlementConfiguration,
  type PaymentMethodCode,
  type PaymentMethodSettlementConfig,
} from "@/domain/settlement/types";
import { updatePaymentMethodSettlementAction } from "@/server/settlement/actions";

const METHOD_LABELS: Record<PaymentMethodCode, string> = {
  STRIPE: "Stripe",
  PAYPAL: "PayPal",
  BANK_PROCESSOR: "Bank processor",
  MANUAL: "Manual",
};

function MethodPanel({
  companyId,
  method,
}: {
  companyId: string;
  method: PaymentMethodSettlementConfig;
}) {
  const [methodEnabled, setMethodEnabled] = useState(method.methodEnabled);
  const [enabledCodes, setEnabledCodes] = useState<string[]>([
    ...method.enabledSettlementCurrencyCodes,
  ]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const activeOptions = method.settlementCurrencies.filter(
    (currency) => currency.globalStatus === "ACTIVE",
  );
  const inactiveAssigned = method.settlementCurrencies.filter(
    (currency) => currency.globalStatus === "INACTIVE" && currency.enabled,
  );

  function toggleCurrency(code: string, checked: boolean) {
    setEnabledCodes((current) => {
      if (checked) {
        return current.includes(code) ? current : [...current, code];
      }
      return current.filter((value) => value !== code);
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const result = await updatePaymentMethodSettlementAction(companyId, method.methodCode, {
      methodEnabled,
      enabledSettlementCurrencyCodes: enabledCodes,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = result.data.methods.find((row) => row.methodCode === method.methodCode);
    if (next) {
      setMethodEnabled(next.methodEnabled);
      setEnabledCodes([...next.enabledSettlementCurrencyCodes]);
    }
    setMessage("Saved.");
  }

  return (
    <form className="grid gap-4 rounded-md border p-4" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{METHOD_LABELS[method.methodCode]}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={methodEnabled}
            onChange={(event) => setMethodEnabled(event.target.checked)}
          />
          Method enabled
        </label>
      </div>

      <div className="grid gap-2">
        <Label>Settlement currencies</Label>
        <p className="text-muted-foreground text-xs">
          Initial defaults highlighted: {INITIAL_SETTLEMENT_CURRENCY_CODES.join(", ")}. Only
          globally ACTIVE currencies can be newly enabled.
        </p>
        <div className="grid gap-2">
          {activeOptions.map((currency) => {
            const checked = enabledCodes.includes(currency.currencyCode);
            return (
              <label
                key={currency.currencyCode}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggleCurrency(currency.currencyCode, event.target.checked)}
                />
                <span className="font-medium">{currency.currencyCode}</span>
                <span className="text-muted-foreground">{currency.name}</span>
                {currency.isInitial ? (
                  <span className="text-muted-foreground text-xs">(initial)</span>
                ) : null}
              </label>
            );
          })}
        </div>
        {inactiveAssigned.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Historically enabled but now globally inactive:{" "}
            {inactiveAssigned.map((currency) => currency.currencyCode).join(", ")}.
          </p>
        ) : null}
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <Button type="submit" disabled={pending} size="sm">
        Save {METHOD_LABELS[method.methodCode]}
      </Button>
    </form>
  );
}

export function SettlementConfigForm({
  configuration,
}: {
  configuration: CompanySettlementConfiguration;
}) {
  return (
    <div className="grid gap-6">
      {configuration.methods.map((method) => (
        <MethodPanel key={method.methodCode} companyId={configuration.companyId} method={method} />
      ))}
      <Link
        href={`/companies/${configuration.companyId}`}
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        Back to company
      </Link>
    </div>
  );
}
