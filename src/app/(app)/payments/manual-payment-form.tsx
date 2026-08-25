"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { FormActions, FormField, FormSection } from "@/components/forms/form-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FIXED_RATE_MISSING_FOR_CONVERSION } from "@/domain/fixed-rates/types";
import {
  previewManualPaymentConversion,
  recordManualPaymentAction,
  type ManualPaymentConversionPreview,
  type ManualPaymentFormContext,
} from "@/server/payments/actions";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultSettlementCurrency(context: ManualPaymentFormContext): string {
  const codes = context.settlementCurrencyCodes;
  if (codes.includes(context.invoice.currencyCode)) {
    return context.invoice.currencyCode;
  }
  return codes[0] ?? "";
}

type ManualPaymentFormProps = {
  readonly context: ManualPaymentFormContext;
  /** When true, show company/customer as read-only context (invoice-bound). */
  readonly lockedInvoice?: boolean;
  readonly onRecorded?: (paymentId: string) => void;
};

/**
 * Manual payment entry form (TASK-051).
 * Submits to TASK-050 recordManualPayment. Preview math is display-only.
 * Remount with `key={context.invoice.id}` when the invoice changes.
 */
export function ManualPaymentForm({
  context,
  lockedInvoice = true,
  onRecorded,
}: ManualPaymentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [previewPending, startPreview] = useTransition();

  const initialSettlement = useMemo(() => defaultSettlementCurrency(context), [context]);

  const [invoiceAmountApplied, setInvoiceAmountApplied] = useState(
    context.invoice.outstandingAmount,
  );
  const [settlementCurrencyCode, setSettlementCurrencyCode] = useState(initialSettlement);
  const [paymentDate, setPaymentDate] = useState(todayIsoDate());
  const [externalTransactionId, setExternalTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [processorFeeAmount, setProcessorFeeAmount] = useState("");
  const [actualReceivedAmount, setActualReceivedAmount] = useState("");
  const [preview, setPreview] = useState<ManualPaymentConversionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!settlementCurrencyCode || !invoiceAmountApplied.trim()) {
      const clearHandle = window.setTimeout(() => {
        setPreview(null);
        setPreviewError(null);
      }, 0);
      return () => window.clearTimeout(clearHandle);
    }

    const handle = window.setTimeout(() => {
      startPreview(async () => {
        const result = await previewManualPaymentConversion({
          invoiceId: context.invoice.id,
          settlementCurrencyCode,
          invoiceAmountApplied: invoiceAmountApplied.trim(),
          paymentDate,
        });
        if (!result.ok) {
          setPreview(null);
          setPreviewError(result.error);
          return;
        }
        setPreviewError(null);
        setPreview(result.data ?? null);
      });
    }, 250);

    return () => window.clearTimeout(handle);
  }, [context.invoice.id, invoiceAmountApplied, settlementCurrencyCode, paymentDate]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await recordManualPaymentAction({
        invoiceId: context.invoice.id,
        invoiceAmountApplied: invoiceAmountApplied.trim(),
        settlementCurrencyCode,
        paymentDate,
        externalTransactionId: externalTransactionId.trim() || null,
        notes: notes.trim() || null,
        processorFeeAmount: processorFeeAmount.trim() || null,
        actualReceivedAmount: actualReceivedAmount.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(result.message ?? "Manual payment recorded.");
      if (result.paymentId) {
        onRecorded?.(result.paymentId);
      }
      router.refresh();
    });
  }

  const methodBlocked = !context.methodEnabled || context.settlementCurrencyCodes.length === 0;

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not record payment</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert>
          <AlertTitle>Payment recorded</AlertTitle>
          <AlertDescription>
            {success} Invoice confirmed paid, outstanding, and status were recalculated from
            confirmed payments. Fee fields are reconciliation only.
          </AlertDescription>
        </Alert>
      ) : null}
      {methodBlocked ? (
        <Alert variant="destructive">
          <AlertTitle>Manual settlement not configured</AlertTitle>
          <AlertDescription>
            Enable the MANUAL payment method and at least one settlement currency for this company
            under Settlement settings before recording.
          </AlertDescription>
        </Alert>
      ) : null}

      <FormSection
        title="Invoice"
        description={
          lockedInvoice
            ? "Company and customer are taken from the invoice (server-authoritative)."
            : "Selected invoice supplies company and customer."
        }
      >
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Invoice</p>
            <p className="font-medium">{context.invoice.label}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{context.invoice.status}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Company</p>
            <p className="font-medium">{context.invoice.companyDisplayName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Customer</p>
            <p className="font-medium">
              {context.invoice.customerDisplayName ?? context.invoice.customerId.slice(0, 8)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Invoice currency</p>
            <p className="font-medium">{context.invoice.currencyCode}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Open balance (SUCCESSFUL payments)</p>
            <p className="font-medium">
              {context.invoice.outstandingAmount} {context.invoice.currencyCode}
            </p>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Payment"
        description="Amount is applied in invoice currency and must not exceed open balance from SUCCESSFUL payments (BR-010). Partial amounts are allowed. Settlement conversion uses the Admin fixed rate on the server."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={`Amount applied (${context.invoice.currencyCode})`}
            htmlFor="invoiceAmountApplied"
            required
            hint="Decimal string only — not a JavaScript number."
          >
            <Input
              id="invoiceAmountApplied"
              name="invoiceAmountApplied"
              inputMode="decimal"
              autoComplete="off"
              value={invoiceAmountApplied}
              onChange={(event) => setInvoiceAmountApplied(event.target.value)}
              required
              disabled={pending || methodBlocked}
            />
          </FormField>
          <FormField label="Settlement currency" htmlFor="settlementCurrencyCode" required>
            <NativeSelect
              id="settlementCurrencyCode"
              name="settlementCurrencyCode"
              value={settlementCurrencyCode}
              onChange={(event) => setSettlementCurrencyCode(event.target.value)}
              required
              disabled={pending || methodBlocked}
            >
              <option value="" disabled>
                Select settlement currency
              </option>
              {context.settlementCurrencyCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Payment date" htmlFor="paymentDate" required>
            <Input
              id="paymentDate"
              name="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              required
              disabled={pending || methodBlocked}
            />
          </FormField>
          <FormField
            label="Reference"
            htmlFor="externalTransactionId"
            hint="Optional human reference. Not a fabricated gateway transaction ID."
          >
            <Input
              id="externalTransactionId"
              name="externalTransactionId"
              value={externalTransactionId}
              onChange={(event) => setExternalTransactionId(event.target.value)}
              disabled={pending || methodBlocked}
            />
          </FormField>
        </div>
        <FormField label="Notes" htmlFor="notes">
          <Textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            disabled={pending || methodBlocked}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Conversion preview"
        description="Display-only estimate. The server locks the Admin fixed-rate snapshot on record. Same-currency uses rate 1."
      >
        {previewPending && !preview && !previewError ? (
          <p className="text-muted-foreground text-sm">Calculating preview…</p>
        ) : null}
        {previewError ? (
          <Alert variant="destructive">
            <AlertTitle>Missing rate</AlertTitle>
            <AlertDescription>
              {previewError === FIXED_RATE_MISSING_FOR_CONVERSION
                ? FIXED_RATE_MISSING_FOR_CONVERSION
                : previewError}
            </AlertDescription>
          </Alert>
        ) : null}
        {preview ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Rate source</dt>
              <dd className="font-medium">
                {preview.rateSource === "same_currency" ? "Same currency (1)" : "Admin fixed rate"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fixed conversion rate</dt>
              <dd className="font-medium">{preview.fixedConversionRate}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Converted settlement (preview)</dt>
              <dd className="font-medium">
                {preview.convertedSettlementAmount} {preview.settlementCurrencyCode}
              </dd>
            </div>
          </dl>
        ) : null}
      </FormSection>

      <FormSection
        title="Reconciliation (optional)"
        description="Processor fee and actual received are reconciliation only. They never change invoice amount applied, converted settlement, or invoice balance."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Processor / merchant fee"
            htmlFor="processorFeeAmount"
            hint="Settlement currency. Reconciliation only."
          >
            <Input
              id="processorFeeAmount"
              name="processorFeeAmount"
              inputMode="decimal"
              autoComplete="off"
              value={processorFeeAmount}
              onChange={(event) => setProcessorFeeAmount(event.target.value)}
              disabled={pending || methodBlocked}
            />
          </FormField>
          <FormField
            label="Actual amount received"
            htmlFor="actualReceivedAmount"
            hint="Optional. Never derived from fee."
          >
            <Input
              id="actualReceivedAmount"
              name="actualReceivedAmount"
              inputMode="decimal"
              autoComplete="off"
              value={actualReceivedAmount}
              onChange={(event) => setActualReceivedAmount(event.target.value)}
              disabled={pending || methodBlocked}
            />
          </FormField>
        </div>
      </FormSection>

      <FormActions>
        <Button type="submit" disabled={pending || methodBlocked || Boolean(previewError)}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
      </FormActions>
    </form>
  );
}
