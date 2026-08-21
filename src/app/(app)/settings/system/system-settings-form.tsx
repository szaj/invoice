"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  systemSettingsUpdateSchema,
  type SystemSettingsUpdateFormValues,
  type SystemSettingsUpdateInput,
} from "@/domain/settings/schema";
import { updateSystemSettingsAction } from "@/server/settings/actions";

export function SystemSettingsForm({
  defaultValues,
}: {
  defaultValues: SystemSettingsUpdateFormValues;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<SystemSettingsUpdateFormValues, unknown, SystemSettingsUpdateInput>({
    resolver: zodResolver(systemSettingsUpdateSchema),
    defaultValues,
  });

  async function onSubmit(values: SystemSettingsUpdateInput) {
    setError(null);
    setMessage(null);
    const result = await updateSystemSettingsAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Saved.");
  }

  return (
    <form className="grid max-w-lg gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-2">
        <Label htmlFor="reportingCurrencyCode">Reporting currency</Label>
        <Input
          id="reportingCurrencyCode"
          autoComplete="off"
          {...form.register("reportingCurrencyCode")}
        />
        <p className="text-muted-foreground text-xs">
          Configurable consolidated reporting currency (ADR-011 remains open). Initial
          recommendation is USD. Currency master validation arrives in a later task.
        </p>
        {form.formState.errors.reportingCurrencyCode ? (
          <p className="text-destructive text-sm">
            {form.formState.errors.reportingCurrencyCode.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="defaultTimezone">Default timezone</Label>
        <Input id="defaultTimezone" autoComplete="off" {...form.register("defaultTimezone")} />
        <p className="text-muted-foreground text-xs">
          IANA timezone for display defaults. Authoritative storage timestamps remain UTC.
        </p>
        {form.formState.errors.defaultTimezone ? (
          <p className="text-destructive text-sm">
            {form.formState.errors.defaultTimezone.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="roundingTolerance">Rounding tolerance (placeholder)</Label>
        <Input id="roundingTolerance" autoComplete="off" {...form.register("roundingTolerance")} />
        <p className="text-muted-foreground text-xs">
          Placeholder for later money utilities. Stored as decimal; not used for calculations yet.
        </p>
        {form.formState.errors.roundingTolerance ? (
          <p className="text-destructive text-sm">
            {form.formState.errors.roundingTolerance.message}
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-3">
        <input
          id="invoiceNumberIncludeYear"
          type="checkbox"
          className="border-input mt-1 h-4 w-4 rounded"
          {...form.register("invoiceNumberIncludeYear")}
        />
        <div className="grid gap-1">
          <Label htmlFor="invoiceNumberIncludeYear">Include year in invoice numbers</Label>
          <p className="text-muted-foreground text-xs">
            When enabled, newly allocated numbers use {"{prefix}{YYYY}-{NNNNNN}"} (company sequence
            still independent). Existing numbers are never changed.
          </p>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Save settings
        </Button>
        <Link href="/" className="text-primary text-sm underline-offset-4 hover:underline">
          Back to home
        </Link>
      </div>
    </form>
  );
}
