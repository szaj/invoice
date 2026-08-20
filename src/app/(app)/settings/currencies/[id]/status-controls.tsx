"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CurrencyStatus } from "@/domain/currencies/types";
import { setCurrencyStatusAction } from "@/server/currencies/actions";

export function CurrencyStatusControls({
  currencyId,
  status,
}: {
  currencyId: string;
  status: CurrencyStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSetStatus(next: CurrencyStatus) {
    setError(null);
    setPending(true);
    const result = await setCurrencyStatusAction(currencyId, next);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-3 border-t pt-4">
      {status === "ACTIVE" ? (
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => onSetStatus("INACTIVE")}
        >
          Disable currency
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => onSetStatus("ACTIVE")}
        >
          Activate currency
        </Button>
      )}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
