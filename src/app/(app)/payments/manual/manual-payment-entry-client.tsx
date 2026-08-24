"use client";

import { useEffect, useState, useTransition } from "react";

import { ManualPaymentForm } from "@/app/(app)/payments/manual-payment-form";
import { FormField, FormSection } from "@/components/forms/form-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { NativeSelect } from "@/components/ui/native-select";
import {
  loadCollectibleInvoicesForManualPayment,
  loadManualPaymentFormContext,
  type ManualPaymentFormContext,
  type ManualPaymentInvoiceOption,
} from "@/server/payments/actions";

type ManualPaymentEntryClientProps = {
  readonly companyId: string;
  readonly companyDisplayName: string;
};

export function ManualPaymentEntryClient({
  companyId,
  companyDisplayName,
}: ManualPaymentEntryClientProps) {
  const [pending, startTransition] = useTransition();
  const [invoices, setInvoices] = useState<ManualPaymentInvoiceOption[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [context, setContext] = useState<ManualPaymentFormContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      setContext(null);
      setInvoiceId("");
      const result = await loadCollectibleInvoicesForManualPayment(companyId);
      if (!result.ok) {
        setError(result.error);
        setInvoices([]);
        return;
      }
      setInvoices(result.data ?? []);
    });
  }, [companyId]);

  function onInvoiceChange(nextId: string) {
    setInvoiceId(nextId);
    setContext(null);
    setError(null);
    if (!nextId) {
      return;
    }
    startTransition(async () => {
      const result = await loadManualPaymentFormContext(nextId);
      if (!result.ok) {
        setError(result.error);
        setContext(null);
        return;
      }
      setContext(result.data ?? null);
    });
  }

  return (
    <div className="grid gap-6">
      <FormSection
        title="Select invoice"
        description={`Company context: ${companyDisplayName}. Company and customer are derived from the selected invoice.`}
      >
        <FormField label="Invoice" htmlFor="manual-payment-invoice" required>
          <NativeSelect
            id="manual-payment-invoice"
            value={invoiceId}
            onChange={(event) => onInvoiceChange(event.target.value)}
            disabled={pending}
          >
            <option value="">Select a collectible invoice</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.label} ({invoice.status})
              </option>
            ))}
          </NativeSelect>
        </FormField>
        {invoices.length === 0 && !pending && !error ? (
          <p className="text-muted-foreground text-sm">No collectible invoices for this company.</p>
        ) : null}
      </FormSection>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {context ? <ManualPaymentForm key={context.invoice.id} context={context} /> : null}
    </div>
  );
}
