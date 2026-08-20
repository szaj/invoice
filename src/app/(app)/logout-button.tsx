"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/auth/actions";

export function LogoutButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setError(null);
    setPending(true);
    const result = await logoutAction();
    if (result && !result.ok) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" onClick={onLogout} disabled={pending}>
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
