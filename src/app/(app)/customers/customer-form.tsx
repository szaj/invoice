"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormActions, FormField, FormSection } from "@/components/forms/form-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ISO_3166_1_ALPHA2 } from "@/domain/companies/countries";
import {
  customerWriteSchema,
  type CustomerWriteFormValues,
  type CustomerWriteInput,
} from "@/domain/customers/schema";
import { createCustomerAction, updateCustomerAction } from "@/server/customers/actions";

type CompanyOption = { id: string; displayName: string };

function tagsToText(tags: readonly string[] | undefined): string {
  return tags && tags.length > 0 ? tags.join(", ") : "";
}

function textToTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function CustomerForm({
  customerId,
  defaultValues,
  companies,
  requireCompany,
  submitLabel,
}: {
  customerId?: string;
  defaultValues: CustomerWriteFormValues;
  companies: readonly CompanyOption[];
  requireCompany: boolean;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tagsText, setTagsText] = useState(tagsToText(defaultValues.tags as string[] | undefined));
  const [duplicateWarning, setDuplicateWarning] = useState<{
    duplicates: NonNullable<
      Extract<Awaited<ReturnType<typeof createCustomerAction>>, { ok: false }>["duplicates"]
    >;
    canAcknowledge: boolean;
  } | null>(null);
  const [acknowledgeDuplicates, setAcknowledgeDuplicates] = useState(false);

  const form = useForm<CustomerWriteFormValues, unknown, CustomerWriteInput>({
    resolver: zodResolver(customerWriteSchema),
    defaultValues: {
      ...defaultValues,
      tags: Array.isArray(defaultValues.tags) ? defaultValues.tags : [],
      companyIds: Array.isArray(defaultValues.companyIds) ? defaultValues.companyIds : [],
      acknowledgeDuplicates: false,
    },
  });

  const companyRequiredHint = useMemo(
    () =>
      requireCompany
        ? "Link at least one assigned company. You cannot link companies outside your assignment."
        : "Optional preference for default brand. Link companies below for tenant access.",
    [requireCompany],
  );

  const companyLinksHint = useMemo(
    () =>
      requireCompany
        ? "Required — select at least one company you can access."
        : "Admin may link any companies. Staff/Compliance only see companies they can access.",
    [requireCompany],
  );

  async function onSubmit(values: CustomerWriteInput) {
    setError(null);
    setMessage(null);
    const rawCompanyIds = values.companyIds as unknown;
    const companyIds = Array.isArray(rawCompanyIds)
      ? rawCompanyIds
      : typeof rawCompanyIds === "string" && rawCompanyIds.length > 0
        ? [rawCompanyIds]
        : [];
    const payload: CustomerWriteInput = {
      ...values,
      tags: textToTags(tagsText),
      companyIds,
      acknowledgeDuplicates: acknowledgeDuplicates || Boolean(values.acknowledgeDuplicates),
    };
    const result = customerId
      ? await updateCustomerAction(customerId, payload)
      : await createCustomerAction(payload);
    if (result && !result.ok) {
      if (result.code === "CUSTOMER_DUPLICATE_WARNING" && result.duplicates) {
        setDuplicateWarning({
          duplicates: result.duplicates,
          canAcknowledge: Boolean(result.canAcknowledgeDuplicates),
        });
        setAcknowledgeDuplicates(false);
      } else {
        setDuplicateWarning(null);
      }
      setError(result.error);
      return;
    }
    setDuplicateWarning(null);
    setAcknowledgeDuplicates(false);
    if (result?.ok) {
      setMessage(result.message ?? "Saved.");
    }
  }

  function clearDuplicateGate() {
    if (duplicateWarning) {
      setDuplicateWarning(null);
      setAcknowledgeDuplicates(false);
      setError(null);
    }
  }

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormSection title="Identity" description="Primary customer identification.">
        <FormField
          label="Customer / company name"
          htmlFor="displayName"
          required
          error={form.formState.errors.displayName?.message}
        >
          <Input
            id="displayName"
            {...form.register("displayName", {
              onChange: () => clearDuplicateGate(),
            })}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Customer type" htmlFor="customerType">
            <NativeSelect id="customerType" {...form.register("customerType")}>
              <option value="BUSINESS">Business</option>
              <option value="INDIVIDUAL">Individual</option>
            </NativeSelect>
          </FormField>
          <FormField label="Contact person" htmlFor="contactPerson">
            <Input id="contactPerson" {...form.register("contactPerson")} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Contact" description="Email is optional.">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input
              id="email"
              type="email"
              {...form.register("email", { onChange: () => clearDuplicateGate() })}
            />
          </FormField>
          <FormField label="Phone" htmlFor="phone">
            <Input
              id="phone"
              {...form.register("phone", { onChange: () => clearDuplicateGate() })}
            />
          </FormField>
          <FormField label="Alternate phone" htmlFor="alternatePhone">
            <Input id="alternatePhone" {...form.register("alternatePhone")} />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Billing address">
        <FormField label="Address line 1" htmlFor="addressLine1">
          <Input id="addressLine1" {...form.register("addressLine1")} />
        </FormField>
        <FormField label="Address line 2" htmlFor="addressLine2">
          <Input id="addressLine2" {...form.register("addressLine2")} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="City" htmlFor="city">
            <Input id="city" {...form.register("city")} />
          </FormField>
          <FormField label="State / region" htmlFor="region">
            <Input id="region" {...form.register("region")} />
          </FormField>
          <FormField label="Postal code" htmlFor="postalCode">
            <Input id="postalCode" {...form.register("postalCode")} />
          </FormField>
        </div>
        <FormField
          label="Country"
          htmlFor="countryCode"
          error={form.formState.errors.countryCode?.message}
        >
          <NativeSelect id="countryCode" {...form.register("countryCode")}>
            <option value="">—</option>
            {ISO_3166_1_ALPHA2.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name} ({country.code})
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </FormSection>

      <FormSection title="Commercial" description="Tax, currency, and company linkage.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Tax / VAT / registration ID" htmlFor="taxRegistrationId">
            <Input id="taxRegistrationId" {...form.register("taxRegistrationId")} />
          </FormField>
          <FormField
            label="Website"
            htmlFor="website"
            error={form.formState.errors.website?.message}
          >
            <Input id="website" type="url" placeholder="https://" {...form.register("website")} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Default invoice currency"
            htmlFor="defaultInvoiceCurrencyCode"
            error={form.formState.errors.defaultInvoiceCurrencyCode?.message}
          >
            <Input
              id="defaultInvoiceCurrencyCode"
              placeholder="USD"
              maxLength={3}
              {...form.register("defaultInvoiceCurrencyCode")}
            />
          </FormField>
          <FormField
            label="Default company / brand"
            htmlFor="defaultCompanyId"
            hint={companyRequiredHint}
          >
            <Controller
              control={form.control}
              name="defaultCompanyId"
              render={({ field }) => (
                <NativeSelect
                  id="defaultCompanyId"
                  value={typeof field.value === "string" ? field.value : ""}
                  onChange={(event) => field.onChange(event.target.value || null)}
                >
                  <option value="">None</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.displayName}
                    </option>
                  ))}
                </NativeSelect>
              )}
            />
          </FormField>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">
            Linked companies
            {requireCompany ? <span className="text-destructive ml-0.5">*</span> : null}
          </legend>
          <p className="text-muted-foreground text-xs">{companyLinksHint}</p>
          {companies.length === 0 ? (
            <p className="text-muted-foreground text-sm">No accessible companies.</p>
          ) : (
            <div className="grid gap-2">
              {companies.map((company) => (
                <label key={company.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={company.id} {...form.register("companyIds")} />
                  <span>{company.displayName}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <FormField label="Payment preference" htmlFor="paymentPreference">
          <Input id="paymentPreference" {...form.register("paymentPreference")} />
        </FormField>
      </FormSection>

      <FormSection title="Internal" description="Not shown to customers.">
        <FormField label="Tags (comma-separated)" htmlFor="tags">
          <Input
            id="tags"
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            placeholder="vip, dubai"
          />
        </FormField>
        <FormField label="Internal notes" htmlFor="internalNotes">
          <Textarea id="internalNotes" {...form.register("internalNotes")} />
        </FormField>
      </FormSection>

      {/* Keep status and assignee in form state; create forces ACTIVE via service. */}
      <input type="hidden" {...form.register("status")} />
      <input type="hidden" {...form.register("assignedStaffUserId")} />

      {duplicateWarning ? (
        <Alert variant="warning">
          <AlertTitle>Possible duplicate customers</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 grid gap-2">
              {duplicateWarning.duplicates.map((dup) => (
                <li key={dup.customerId}>
                  <Link
                    href={`/customers/${dup.customerId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {dup.displayName}
                  </Link>
                  {" — matched on "}
                  {dup.matchedFields.join(", ")}
                  {dup.status === "INACTIVE" ? " (inactive)" : ""}
                </li>
              ))}
            </ul>
            {duplicateWarning.canAcknowledge ? (
              <label className="mt-3 flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acknowledgeDuplicates}
                  onChange={(event) => setAcknowledgeDuplicates(event.target.checked)}
                />
                <span>I understand this may be a duplicate and want to proceed anyway.</span>
              </label>
            ) : (
              <p className="mt-2 text-xs opacity-90">
                Ask an Admin or Compliance user to create or update if this customer should still be
                saved.
              </p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        <Button
          type="submit"
          disabled={
            form.formState.isSubmitting ||
            (Boolean(duplicateWarning) &&
              duplicateWarning!.canAcknowledge &&
              !acknowledgeDuplicates) ||
            (Boolean(duplicateWarning) && !duplicateWarning!.canAcknowledge)
          }
        >
          {duplicateWarning && duplicateWarning.canAcknowledge && acknowledgeDuplicates
            ? `${submitLabel} anyway`
            : submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link href={customerId ? `/customers/${customerId}` : "/customers"}>Cancel</Link>
        </Button>
      </FormActions>
    </form>
  );
}
