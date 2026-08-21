"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/data/empty-state";
import { FormField } from "@/components/forms/form-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmailLogRecord, InvoiceEmailComposeDefaults } from "@/domain/invoices/email";
import { sendInvoiceEmailAction } from "@/server/invoices/actions";

function formatWhen(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

type InvoiceEmailPanelProps = {
  invoiceId: string;
  invoiceStatus: string;
  compose: InvoiceEmailComposeDefaults | null;
  composeError?: string | null;
  initialLogs: readonly EmailLogRecord[];
};

export function InvoiceEmailPanel({
  invoiceId,
  invoiceStatus,
  compose,
  composeError,
  initialLogs,
}: InvoiceEmailPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState(initialLogs);
  const [recipient, setRecipient] = useState(compose?.recipient ?? "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(compose?.subject ?? "");
  const [body, setBody] = useState(compose?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isDraft = invoiceStatus === "DRAFT";
  const canOpenCompose = !isDraft && compose != null && !composeError;

  function openModal() {
    if (!compose) {
      return;
    }
    setRecipient(compose.recipient ?? "");
    setSubject(compose.subject);
    setBody(compose.body);
    setCc("");
    setBcc("");
    setError(null);
    setSuccess(null);
    setOpen(true);
  }

  function onSend(retry = false) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await sendInvoiceEmailAction(invoiceId, {
        recipient: recipient.trim() || null,
        cc: compose?.canCcBcc ? cc : "",
        bcc: compose?.canCcBcc ? bcc : "",
        subject,
        body,
        invoiceFileId: compose?.invoiceFileId ?? null,
      });
      if (!result.ok) {
        setError(`${result.error} The invoice remains issued — you can retry without un-issuing.`);
        return;
      }
      setSuccess(result.message ?? "Invoice emailed.");
      setOpen(false);
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/email`, {
          credentials: "same-origin",
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          logs?: EmailLogRecord[];
        };
        if (response.ok && payload.ok && payload.logs) {
          setLogs(payload.logs);
        }
      } catch {
        // History refresh is best-effort; page refresh still applies.
      }
      router.refresh();
      if (retry) {
        // no-op; kept for call-site clarity
      }
    });
  }

  return (
    <section className="bg-card rounded-lg border shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="grid gap-1">
          <h2 className="text-base font-semibold">Email</h2>
          <p className="text-muted-foreground text-sm">
            Send the stored invoice PDF to the customer. Delivery status is logged; failures do not
            un-issue the invoice.
          </p>
        </div>
        {canOpenCompose ? (
          <Button type="button" onClick={openModal} data-testid="invoice-email-open">
            Email invoice
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 px-5 py-4">
        {isDraft ? (
          <p className="text-muted-foreground text-sm">Issue the invoice before emailing.</p>
        ) : null}
        {composeError ? (
          <Alert variant="destructive">
            <AlertDescription>{composeError}</AlertDescription>
          </Alert>
        ) : null}
        {compose?.blockReason && !isDraft ? (
          <Alert variant="warning">
            <AlertDescription>{compose.blockReason}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert variant="success">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        {logs.length === 0 ? (
          <EmptyState
            compact
            title="No emails sent yet"
            description="Use Email invoice to send the stored PDF with the company template."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>When</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatWhen(log.createdAt)}</TableCell>
                  <TableCell>{log.recipient}</TableCell>
                  <TableCell className="max-w-[14rem] truncate">{log.subject}</TableCell>
                  <TableCell>
                    <StatusBadge status={log.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[12rem] truncate text-xs">
                    {log.status === "FAILED"
                      ? (log.errorMessage ?? "Failed")
                      : (log.providerMessageId ?? "—")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {logs.some((log) => log.status === "FAILED" && log.retryable) && canOpenCompose ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openModal}>
              Retry failed send
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Email invoice</DialogTitle>
            <DialogDescription>
              Recipient defaults to the customer email (BR-017). The stored versioned PDF is
              attached automatically
              {compose?.hasStoredPdf ? "" : " (generated on send if missing)"}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-1">
            <FormField label="To" htmlFor="invoice-email-to" required>
              <Input
                id="invoice-email-to"
                type="email"
                data-testid="invoice-email-to"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                disabled={pending}
              />
            </FormField>

            {compose?.canCcBcc ? (
              <>
                <FormField
                  label="CC"
                  htmlFor="invoice-email-cc"
                  hint="Comma-separated. Requires invoice.edit_issued."
                >
                  <Input
                    id="invoice-email-cc"
                    data-testid="invoice-email-cc"
                    value={cc}
                    onChange={(event) => setCc(event.target.value)}
                    disabled={pending}
                    placeholder="optional@example.com"
                  />
                </FormField>
                <FormField label="BCC" htmlFor="invoice-email-bcc" hint="Comma-separated.">
                  <Input
                    id="invoice-email-bcc"
                    data-testid="invoice-email-bcc"
                    value={bcc}
                    onChange={(event) => setBcc(event.target.value)}
                    disabled={pending}
                    placeholder="optional@example.com"
                  />
                </FormField>
              </>
            ) : (
              <p className="text-muted-foreground text-xs">
                CC/BCC are available to Admin and Compliance only.
              </p>
            )}

            <FormField label="Subject" htmlFor="invoice-email-subject" required>
              <Input
                id="invoice-email-subject"
                data-testid="invoice-email-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={pending}
              />
            </FormField>

            <FormField label="Body" htmlFor="invoice-email-body" required>
              <Textarea
                id="invoice-email-body"
                data-testid="invoice-email-body"
                className="min-h-40"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                disabled={pending}
              />
            </FormField>

            <Alert variant="info">
              <AlertTitle>PDF attachment</AlertTitle>
              <AlertDescription>
                The stored invoice PDF is attached by the server. Email is not marked sent without
                an attachment.
              </AlertDescription>
            </Alert>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="invoice-email-send"
              onClick={() => onSend(false)}
              disabled={pending || !recipient.trim() || !subject.trim() || !body.trim()}
            >
              {pending ? "Sending…" : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
