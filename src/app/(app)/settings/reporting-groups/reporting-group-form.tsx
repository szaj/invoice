"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  reportingGroupWriteSchema,
  type ReportingGroupWriteFormValues,
  type ReportingGroupWriteInput,
} from "@/domain/reporting-groups/schema";
import {
  createReportingGroupAction,
  setReportingGroupStatusAction,
  updateReportingGroupAction,
} from "@/server/reporting-groups/actions";

type CompanyOption = {
  readonly id: string;
  readonly displayName: string;
  readonly status: "ACTIVE" | "INACTIVE";
};

export function ReportingGroupForm({
  groupId,
  defaultValues,
  companies,
  submitLabel,
}: {
  groupId?: string;
  defaultValues: ReportingGroupWriteFormValues;
  companies: readonly CompanyOption[];
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<"ACTIVE" | "INACTIVE">(
    (defaultValues.status as "ACTIVE" | "INACTIVE" | undefined) ?? "ACTIVE",
  );
  const form = useForm<ReportingGroupWriteFormValues, unknown, ReportingGroupWriteInput>({
    resolver: zodResolver(reportingGroupWriteSchema),
    defaultValues: {
      ...defaultValues,
      companyIds: defaultValues.companyIds ?? [],
    },
  });

  async function onSubmit(values: ReportingGroupWriteInput) {
    setError(null);
    setMessage(null);
    const result = groupId
      ? await updateReportingGroupAction(groupId, values)
      : await createReportingGroupAction(values);
    if (result && !result.ok) {
      setError(result.error);
      return;
    }
    if (result?.ok) {
      setMessage(result.message ?? "Saved.");
    }
  }

  async function onSetStatus(status: "ACTIVE" | "INACTIVE") {
    if (!groupId) {
      return;
    }
    setError(null);
    setMessage(null);
    const result = await setReportingGroupStatusAction(groupId, status);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Status updated.");
    form.setValue("status", status);
    setCurrentStatus(status);
  }

  return (
    <div className="grid gap-6">
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" placeholder="VX" {...form.register("code")} />
            {form.formState.errors.code ? (
              <p className="text-destructive text-sm">{form.formState.errors.code.message}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Short code for the group (example only: VX). Not seed data.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
          <div className="grid gap-2">
            <Label htmlFor="displayOrder">Display order</Label>
            <Input id="displayOrder" type="number" min={0} {...form.register("displayOrder")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              {...form.register("status")}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Assign companies</legend>
          <p className="text-muted-foreground text-xs">
            Membership is for reporting roll-ups only. It does not grant company access; Staff and
            Compliance still require user-company assignment.
          </p>
          {companies.length === 0 ? (
            <p className="text-muted-foreground text-sm">No companies available to assign.</p>
          ) : (
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border p-3">
              {companies.map((company) => (
                <label key={company.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={company.id} {...form.register("companyIds")} />
                  <span>
                    {company.displayName}
                    {company.status === "INACTIVE" ? " (inactive)" : ""}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : submitLabel}
          </Button>
          <Button asChild variant="outline">
            <Link
              href={
                groupId ? `/settings/reporting-groups/${groupId}` : "/settings/reporting-groups"
              }
            >
              Cancel
            </Link>
          </Button>
        </div>
      </form>

      {groupId ? (
        <div className="flex flex-wrap gap-3 border-t pt-4">
          {currentStatus === "ACTIVE" ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onSetStatus("INACTIVE")}
            >
              Deactivate group
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => void onSetStatus("ACTIVE")}>
              Activate group
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
