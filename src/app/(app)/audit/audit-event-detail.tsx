"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AuditLogRow } from "@/server/audit/actions";

function JsonBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      {value ? (
        <pre className="bg-muted text-muted-foreground max-h-48 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
          {value}
        </pre>
      ) : (
        <p className="text-muted-foreground text-sm">None</p>
      )}
    </div>
  );
}

export function AuditEventDetailButton({ event }: { event: AuditLogRow }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{event.action}</DialogTitle>
          <DialogDescription>
            Read-only audit event. Sensitive values are masked. Records cannot be edited or deleted.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 text-sm">
          <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">When</dt>
            <dd>{event.occurredAtDisplay}</dd>
          </div>
          <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Actor</dt>
            <dd>
              {event.actorLabel}
              {event.actorUserId ? (
                <span className="text-muted-foreground font-mono text-xs">
                  {" "}
                  {event.actorUserId}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Company</dt>
            <dd>{event.companyDisplayName}</dd>
          </div>
          <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Entity</dt>
            <dd className="font-mono text-xs">
              {event.entityType}
              {event.entityId ? ` · ${event.entityId}` : ""}
            </dd>
          </div>
          <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Reason</dt>
            <dd>{event.reason ?? "—"}</dd>
          </div>
          <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">IP</dt>
            <dd className="font-mono text-xs">{event.ipAddress ?? "—"}</dd>
          </div>
          <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">User agent</dt>
            <dd className="text-muted-foreground text-xs break-all">{event.userAgent ?? "—"}</dd>
          </div>
          <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Correlation</dt>
            <dd className="font-mono text-xs">{event.correlationId ?? "—"}</dd>
          </div>
        </dl>
        <JsonBlock label="Old values" value={event.oldValuesJson} />
        <JsonBlock label="New values" value={event.newValuesJson} />
      </DialogContent>
    </Dialog>
  );
}
