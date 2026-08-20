"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CompanyStatus } from "@/domain/companies/types";
import { setCompanyStatusAction } from "@/server/companies/actions";

export function CompanyStatusControls({
  companyId,
  status,
}: {
  companyId: string;
  status: CompanyStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSetStatus(next: CompanyStatus) {
    setError(null);
    setPending(true);
    const result = await setCompanyStatusAction(companyId, next);
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
          Deactivate company
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => onSetStatus("ACTIVE")}
        >
          Activate company
        </Button>
      )}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
