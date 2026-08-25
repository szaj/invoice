"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateIssuedInvoiceMetadataAction } from "@/server/invoices/actions";

export function IssuedInvoiceMetadataForm({
  invoiceId,
  defaultValues,
}: {
  invoiceId: string;
  defaultValues: {
    referencePo: string;
    assignedStaffUserId: string;
    internalNotes: string;
    customerNotes: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      referencePo: String(form.get("referencePo") ?? ""),
      assignedStaffUserId: String(form.get("assignedStaffUserId") ?? "") || null,
      internalNotes: String(form.get("internalNotes") ?? ""),
      customerNotes: String(form.get("customerNotes") ?? ""),
    };
    startTransition(async () => {
      const result = await updateIssuedInvoiceMetadataAction(invoiceId, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Saved.");
      router.refresh();
    });
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit} noValidate>
      <p className="text-muted-foreground text-xs">
        Non-financial metadata only. Financial fields, dates, currency, customer, and line items
        cannot be changed while ADR-009 is open. Compliance status is changed via compliance review
        (Admin/Compliance only).
      </p>
      <div className="grid gap-2">
        <Label htmlFor="issued-referencePo">Reference / PO</Label>
        <Input
          id="issued-referencePo"
          name="referencePo"
          defaultValue={defaultValues.referencePo}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="issued-assignedStaffUserId">Assigned staff user ID</Label>
        <Input
          id="issued-assignedStaffUserId"
          name="assignedStaffUserId"
          defaultValue={defaultValues.assignedStaffUserId}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="issued-internalNotes">Internal notes</Label>
        <textarea
          id="issued-internalNotes"
          name="internalNotes"
          className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
          defaultValue={defaultValues.internalNotes}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="issued-customerNotes">Customer notes</Label>
        <textarea
          id="issued-customerNotes"
          name="customerNotes"
          className="border-input bg-background min-h-20 rounded-md border px-3 py-2 text-sm"
          defaultValue={defaultValues.customerNotes}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save metadata"}
      </Button>
    </form>
  );
}
