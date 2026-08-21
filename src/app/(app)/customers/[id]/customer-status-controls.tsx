"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { setCustomerStatusAction } from "@/server/customers/actions";

export function CustomerStatusControls({
  customerId,
  status,
}: {
  customerId: string;
  status: "ACTIVE" | "INACTIVE";
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSetStatus(next: "ACTIVE" | "INACTIVE") {
    setError(null);
    setMessage(null);
    setPending(true);
    const result = await setCustomerStatusAction(customerId, next);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Status updated.");
  }

  return (
    <div className="grid gap-2">
      <p className="text-muted-foreground text-xs">
        Soft status only (Admin). Deactivation blocks new invoices when invoicing is enabled and
        preserves history. Hard delete is not available to any role.
      </p>
      <p className="text-sm">
        Current status: <span className="font-medium">{status}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {status === "ACTIVE" ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void onSetStatus("INACTIVE")}
          >
            Deactivate
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void onSetStatus("ACTIVE")}
          >
            Activate
          </Button>
        )}
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
    </div>
  );
}
