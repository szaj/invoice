"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { NewDocumentCurrencyPicker } from "@/components/currencies/new-document-currency-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CurrencyPickerOption } from "@/domain/currencies/selection";
import {
  invoiceDraftWriteSchema,
  type InvoiceDraftWriteFormValues,
  type InvoiceDraftWriteInput,
} from "@/domain/invoices/schema";
import { INVOICE_COMPLIANCE_STATUSES } from "@/domain/invoices/types";
import {
  createDraftInvoiceAction,
  loadInvoiceFormOptionsForCompanyAction,
  updateDraftInvoiceAction,
} from "@/server/invoices/actions";

type CompanyOption = { id: string; displayName: string };
type CustomerOption = { id: string; displayName: string; companyIds: string[] };

export function InvoiceDraftForm({
  invoiceId,
  defaultValues,
  companies,
  initialCustomers,
  initialCurrencies,
  submitLabel,
}: {
  invoiceId?: string;
  defaultValues: InvoiceDraftWriteFormValues;
  companies: readonly CompanyOption[];
  initialCustomers: readonly CustomerOption[];
  initialCurrencies: readonly CurrencyPickerOption[];
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([...initialCustomers]);
  const [currencies, setCurrencies] = useState<CurrencyPickerOption[]>([...initialCurrencies]);
  const [optionsPending, startOptionsTransition] = useTransition();

  const form = useForm<InvoiceDraftWriteFormValues, unknown, InvoiceDraftWriteInput>({
    resolver: zodResolver(invoiceDraftWriteSchema),
    defaultValues: {
      ...defaultValues,
      assignedStaffUserId: defaultValues.assignedStaffUserId ?? null,
      complianceStatus: defaultValues.complianceStatus ?? "NOT_REVIEWED",
      referencePo: defaultValues.referencePo ?? "",
      internalNotes: defaultValues.internalNotes ?? "",
      customerNotes: defaultValues.customerNotes ?? "",
    },
  });

  const companyId = useWatch({ control: form.control, name: "companyId" });

  useEffect(() => {
    if (!companyId || typeof companyId !== "string") {
      return;
    }
    startOptionsTransition(async () => {
      const options = await loadInvoiceFormOptionsForCompanyAction(companyId);
      if (!options.ok) {
        return;
      }
      setCustomers(options.customers);
      setCurrencies(options.currencies);
      const currentCustomerId = form.getValues("customerId");
      if (
        currentCustomerId &&
        !options.customers.some((customer) => customer.id === currentCustomerId)
      ) {
        form.setValue("customerId", "" as unknown as string);
      }
      const currentCurrency = form.getValues("currencyCode");
      if (
        currentCurrency &&
        !options.currencies.some((currency) => currency.code === currentCurrency)
      ) {
        const fallback = options.currencies[0]?.code ?? "";
        form.setValue("currencyCode", fallback);
      } else if (!currentCurrency && options.currencies[0]) {
        form.setValue("currencyCode", options.currencies[0].code);
      }
    });
    // form helpers are stable enough for company-driven option reload
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when company changes
  }, [companyId]);

  async function onSubmit(values: InvoiceDraftWriteInput) {
    setError(null);
    setMessage(null);
    const result = invoiceId
      ? await updateDraftInvoiceAction(invoiceId, values)
      : await createDraftInvoiceAction(values);
    if (result && !result.ok) {
      setError(result.error);
      return;
    }
    if (result?.ok) {
      setMessage(result.message ?? "Saved.");
    }
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-2">
        <Label htmlFor="invoice-company">Company</Label>
        <select
          id="invoice-company"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          {...form.register("companyId")}
        >
          <option value="">Select company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
        </select>
        {form.formState.errors.companyId ? (
          <p className="text-destructive text-sm">{form.formState.errors.companyId.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="invoice-customer">Customer</Label>
        <select
          id="invoice-customer"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          disabled={optionsPending}
          {...form.register("customerId")}
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.displayName}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Only active customers linked to the selected company are listed.
        </p>
        {form.formState.errors.customerId ? (
          <p className="text-destructive text-sm">{form.formState.errors.customerId.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="invoice-date">Invoice date</Label>
          <Input id="invoice-date" type="date" {...form.register("invoiceDate")} />
          {form.formState.errors.invoiceDate ? (
            <p className="text-destructive text-sm">
              {String(form.formState.errors.invoiceDate.message)}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invoice-due-date">Due date</Label>
          <Input id="invoice-due-date" type="date" {...form.register("dueDate")} />
          {form.formState.errors.dueDate ? (
            <p className="text-destructive text-sm">
              {String(form.formState.errors.dueDate.message)}
            </p>
          ) : null}
        </div>
      </div>

      <Controller
        control={form.control}
        name="currencyCode"
        render={({ field }) => (
          <NewDocumentCurrencyPicker
            id="invoice-currency"
            options={currencies}
            valueMode="code"
            value={typeof field.value === "string" ? field.value : null}
            onChange={(next) => field.onChange(next ?? "")}
            required
            disabled={optionsPending}
          />
        )}
      />
      {form.formState.errors.currencyCode ? (
        <p className="text-destructive text-sm">{form.formState.errors.currencyCode.message}</p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="invoice-reference">Reference / PO</Label>
        <Input id="invoice-reference" {...form.register("referencePo")} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="invoice-compliance">Compliance status</Label>
        <select
          id="invoice-compliance"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          {...form.register("complianceStatus")}
        >
          {INVOICE_COMPLIANCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="invoice-internal-notes">Internal notes</Label>
        <textarea
          id="invoice-internal-notes"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring min-h-24 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          {...form.register("internalNotes")}
        />
        <p className="text-muted-foreground text-xs">
          Internal only — never presented as customer-visible, and never printed or emailed.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="invoice-customer-notes">Customer notes</Label>
        <textarea
          id="invoice-customer-notes"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring min-h-24 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          {...form.register("customerNotes")}
        />
        <p className="text-muted-foreground text-xs">
          Optional notes that may appear on the invoice.
        </p>
      </div>

      <CardTotalsPlaceholder />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting || optionsPending}>
          {submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link href={invoiceId ? `/invoices/${invoiceId}` : "/invoices"}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

function CardTotalsPlaceholder() {
  return (
    <div className="border-border rounded-md border border-dashed p-4">
      <p className="text-sm font-medium">Totals</p>
      <p className="text-muted-foreground text-sm">
        Display-only totals appear when line-item calculation exists (TASK-034). No amounts are
        invented here.
      </p>
    </div>
  );
}
