"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ISO_3166_1_ALPHA2 } from "@/domain/companies/countries";
import {
  companyWriteSchema,
  type CompanyWriteFormValues,
  type CompanyWriteInput,
} from "@/domain/companies/company-schema";
import {
  createCompanyAction,
  setCompanyStatusAction,
  updateCompanyAction,
} from "@/server/companies/actions";

export function CompanyForm({
  companyId,
  defaultValues,
  submitLabel,
}: {
  companyId?: string;
  defaultValues: CompanyWriteFormValues;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<"ACTIVE" | "INACTIVE">(
    defaultValues.status ?? "ACTIVE",
  );
  const form = useForm<CompanyWriteFormValues, unknown, CompanyWriteInput>({
    resolver: zodResolver(companyWriteSchema),
    defaultValues,
  });

  async function onSubmit(values: CompanyWriteInput) {
    setError(null);
    setMessage(null);
    const result = companyId
      ? await updateCompanyAction(companyId, values)
      : await createCompanyAction(values);
    if (result && !result.ok) {
      setError(result.error);
      return;
    }
    if (result?.ok) {
      setMessage(result.message ?? "Saved.");
    }
  }

  async function onSetStatus(status: "ACTIVE" | "INACTIVE") {
    if (!companyId) {
      return;
    }
    setError(null);
    setMessage(null);
    const result = await setCompanyStatusAction(companyId, status);
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
        <div className="grid gap-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" {...form.register("displayName")} />
          {form.formState.errors.displayName ? (
            <p className="text-destructive text-sm">{form.formState.errors.displayName.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="legalName">Legal name (optional)</Label>
          <Input id="legalName" {...form.register("legalName")} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {form.formState.errors.email ? (
              <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...form.register("phone")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" type="url" placeholder="https://" {...form.register("website")} />
            {form.formState.errors.website ? (
              <p className="text-destructive text-sm">{form.formState.errors.website.message}</p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="registrationTaxNumber">Registration / tax number (optional)</Label>
          <Input id="registrationTaxNumber" {...form.register("registrationTaxNumber")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="addressLine1">Address line 1</Label>
          <Input id="addressLine1" {...form.register("addressLine1")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="addressLine2">Address line 2</Label>
          <Input id="addressLine2" {...form.register("addressLine2")} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
          <div className="grid gap-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...form.register("city")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="region">Region / state</Label>
            <Input id="region" {...form.register("region")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" {...form.register("postalCode")} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
          <div className="grid gap-2">
            <Label htmlFor="countryCode">Country</Label>
            <select
              id="countryCode"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              {...form.register("countryCode")}
            >
              <option value="">Select country</option>
              {ISO_3166_1_ALPHA2.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.code})
                </option>
              ))}
            </select>
            {form.formState.errors.countryCode ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.countryCode.message}
              </p>
            ) : null}
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
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : submitLabel}
          </Button>
          <Button asChild variant="outline">
            <Link href={companyId ? `/companies/${companyId}` : "/companies"}>Cancel</Link>
          </Button>
        </div>
      </form>

      {companyId ? (
        <div className="flex flex-wrap gap-3 border-t pt-4">
          {currentStatus === "ACTIVE" ? (
            <Button type="button" variant="destructive" onClick={() => onSetStatus("INACTIVE")}>
              Deactivate company
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => onSetStatus("ACTIVE")}>
              Activate company
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
