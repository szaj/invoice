"use client";

import { useState } from "react";

import { ManualPaymentForm } from "@/app/(app)/payments/manual-payment-form";
import { DetailSection } from "@/components/layout/detail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ManualPaymentFormContext } from "@/server/payments/actions";

type InvoiceRecordPaymentPanelProps = {
  readonly canRecord: boolean;
  readonly collectible: boolean;
  readonly context: ManualPaymentFormContext | null;
  readonly contextError?: string | null;
};

/**
 * Record Payment on invoice detail (TASK-051).
 * Visibility only — server enforces payment.manual.record.
 */
export function InvoiceRecordPaymentPanel({
  canRecord,
  collectible,
  context,
  contextError,
}: InvoiceRecordPaymentPanelProps) {
  const [open, setOpen] = useState(false);

  if (!canRecord) {
    return null;
  }

  if (!collectible) {
    return (
      <DetailSection
        title="Record payment"
        description="Manual payment recording for collectible invoices."
      >
        <p className="text-muted-foreground text-sm">
          Draft and cancelled invoices cannot receive payments.
        </p>
      </DetailSection>
    );
  }

  return (
    <DetailSection
      title="Record payment"
      description="Record a payment received outside an automated gateway. Uses the MANUAL method and Admin fixed-rate snapshot."
    >
      {contextError ? (
        <Alert variant="destructive">
          <AlertDescription>{contextError}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="button" onClick={() => setOpen(true)} disabled={!context}>
        Record payment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record manual payment</DialogTitle>
            <DialogDescription>
              Confirmation creates an immutable SUCCESSFUL payment. Invoice balance allocation is
              unchanged until a later allocation task.
            </DialogDescription>
          </DialogHeader>
          {context ? (
            <ManualPaymentForm context={context} lockedInvoice onRecorded={() => setOpen(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </DetailSection>
  );
}
