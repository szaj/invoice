"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cancelInvoiceAction } from "@/server/invoices/actions";

export function InvoiceCancelControls({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelInvoiceAction(invoiceId, { reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Cancel invoice
      </Button>
    );
  }

  return (
    <div className="grid min-w-[16rem] gap-3 rounded-md border p-3">
      <div className="grid gap-1">
        <Label htmlFor={`cancel-reason-${invoiceId}`}>Cancellation reason</Label>
        <textarea
          id={`cancel-reason-${invoiceId}`}
          className="border-input bg-background min-h-[4.5rem] w-full rounded-md border px-3 py-2 text-sm"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Required — explain why this invoice is cancelled"
          disabled={pending}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" onClick={onCancel} disabled={pending}>
          {pending ? "Cancelling…" : "Confirm cancel"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
            setReason("");
          }}
        >
          Close
        </Button>
      </div>
    </div>
  );
}
