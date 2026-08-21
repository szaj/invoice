"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CustomerNoteRecord } from "@/domain/customers/notes";
import { createCustomerNoteAction } from "@/server/customers/actions";

export function CustomerNotesPanel({
  customerId,
  notes,
}: {
  customerId: string;
  notes: readonly CustomerNoteRecord[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await createCustomerNoteAction(customerId, { body });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-xs">
        Internal-only. Notes are never shown on customer-facing PDFs or emails.
      </p>

      {notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No internal notes yet.</p>
      ) : (
        <ul className="grid gap-3">
          {notes.map((note) => (
            <li key={note.id} className="border-border rounded-md border p-3 text-sm">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="text-muted-foreground mt-2 text-xs">
                {note.authorName ?? "Unknown author"} ·{" "}
                {note.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC ·{" "}
                {note.visibility}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form className="grid gap-3" onSubmit={(event) => void onSubmit(event)}>
        <div className="grid gap-2">
          <Label htmlFor="customer-note-body">Add note</Label>
          <textarea
            id="customer-note-body"
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-24 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={5000}
            required
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <div>
          <Button type="submit" disabled={pending || body.trim().length === 0}>
            Add note
          </Button>
        </div>
      </form>
    </div>
  );
}
