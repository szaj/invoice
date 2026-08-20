"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  currencyUpdateSchema,
  currencyWriteSchema,
  type CurrencyUpdateInput,
  type CurrencyWriteFormValues,
  type CurrencyWriteInput,
} from "@/domain/currencies/schema";
import {
  createCurrencyAction,
  setCurrencyStatusAction,
  updateCurrencyAction,
} from "@/server/currencies/actions";

type EditFormValues = {
  name: string;
  symbol: string;
  decimalPrecision: number;
  status: "ACTIVE" | "INACTIVE";
};

export function CurrencyForm({
  currencyId,
  defaultValues,
  submitLabel,
  codeLocked = false,
}: {
  currencyId?: string;
  defaultValues: CurrencyWriteFormValues | EditFormValues;
  submitLabel: string;
  codeLocked?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<"ACTIVE" | "INACTIVE">(
    defaultValues.status ?? "ACTIVE",
  );

  const isEdit = Boolean(currencyId);
  const form = useForm({
    resolver: zodResolver(isEdit ? currencyUpdateSchema : currencyWriteSchema),
    defaultValues,
  });

  async function onSubmit(values: CurrencyWriteInput | CurrencyUpdateInput) {
    setError(null);
    setMessage(null);
    const result = currencyId
      ? await updateCurrencyAction(currencyId, values)
      : await createCurrencyAction(values);
    if (result && !result.ok) {
      setError(result.error);
      return;
    }
    if (result?.ok) {
      setMessage(result.message ?? "Saved.");
      if ("status" in values) {
        setCurrentStatus(values.status);
      }
    }
  }

  async function onSetStatus(status: "ACTIVE" | "INACTIVE") {
    if (!currencyId) {
      return;
    }
    setError(null);
    setMessage(null);
    const result = await setCurrencyStatusAction(currencyId, status);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Status updated.");
    form.setValue("status", status);
    setCurrentStatus(status);
  }

  return (
    <form
      className="grid max-w-lg gap-4"
      onSubmit={form.handleSubmit((values) => onSubmit(values as CurrencyWriteInput))}
      noValidate
    >
      {!codeLocked ? (
        <div className="grid gap-2">
          <Label htmlFor="code">Code</Label>
          <Input id="code" autoComplete="off" {...form.register("code")} />
          <p className="text-muted-foreground text-xs">ISO-style 3-letter code (e.g. USD).</p>
          {"code" in form.formState.errors && form.formState.errors.code ? (
            <p className="text-destructive text-sm">{String(form.formState.errors.code.message)}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2">
          <Label>Code</Label>
          <p className="text-sm font-medium">{"code" in defaultValues ? defaultValues.code : ""}</p>
          <p className="text-muted-foreground text-xs">
            Currency codes are immutable after create.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" autoComplete="off" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="symbol">Symbol</Label>
        <Input id="symbol" autoComplete="off" {...form.register("symbol")} />
        {form.formState.errors.symbol ? (
          <p className="text-destructive text-sm">{form.formState.errors.symbol.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="decimalPrecision">Decimal precision</Label>
        <Input
          id="decimalPrecision"
          type="number"
          min={0}
          max={6}
          {...form.register("decimalPrecision")}
        />
        {form.formState.errors.decimalPrecision ? (
          <p className="text-destructive text-sm">
            {form.formState.errors.decimalPrecision.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          {...form.register("status")}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {submitLabel}
        </Button>
        {currencyId ? (
          currentStatus === "ACTIVE" ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onSetStatus("INACTIVE")}
              disabled={form.formState.isSubmitting}
            >
              Disable currency
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onSetStatus("ACTIVE")}
              disabled={form.formState.isSubmitting}
            >
              Activate currency
            </Button>
          )
        ) : null}
        <Link
          href="/settings/currencies"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          Back to currencies
        </Link>
      </div>
    </form>
  );
}
