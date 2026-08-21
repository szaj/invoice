"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { issueInvoiceAction } from "@/server/invoices/actions";

export function InvoiceIssueButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onIssue() {
    setError(null);
    startTransition(async () => {
      const result = await issueInvoiceAction(invoiceId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <Button type="button" onClick={onIssue} disabled={pending}>
        {pending ? "Issuing…" : "Issue invoice"}
      </Button>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
