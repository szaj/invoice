"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { setReportingGroupStatusAction } from "@/server/reporting-groups/actions";

export function ReportingGroupStatusControls({
  groupId,
  status,
}: {
  groupId: string;
  status: "ACTIVE" | "INACTIVE";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSetStatus(next: "ACTIVE" | "INACTIVE") {
    setError(null);
    setBusy(true);
    try {
      const result = await setReportingGroupStatusAction(groupId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2 border-t pt-4">
      {status === "ACTIVE" ? (
        <Button
          type="button"
          variant="destructive"
          disabled={busy}
          onClick={() => void onSetStatus("INACTIVE")}
        >
          Deactivate group
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void onSetStatus("ACTIVE")}
        >
          Activate group
        </Button>
      )}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
