"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { duplicateInvoiceAction } from "@/server/invoices/actions";

export function InvoiceDuplicateButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDuplicate() {
    setError(null);
    startTransition(async () => {
      const result = await duplicateInvoiceAction(invoiceId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.invoiceId) {
        router.push(`/invoices/${result.invoiceId}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={onDuplicate}
        disabled={pending}
        data-testid="invoice-duplicate"
      >
        {pending ? "Duplicating…" : "Duplicate"}
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
