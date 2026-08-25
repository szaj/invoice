"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { EmptyState } from "@/components/data/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { FormField } from "@/components/forms/form-section";
import { DetailSection } from "@/components/layout/detail";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addPaymentAdjustmentNoteAction,
  cancelPaymentAdjustmentAction,
  openPaymentDisputeAction,
  processFullRefundAction,
  processPartialRefundAction,
  recordChargebackDebitAction,
  recordChargebackWonAction,
  type PaymentAdjustmentUiContext,
  type PaymentAdjustmentUiRow,
} from "@/server/payments/adjustment-ui-actions";

type ActionKind =
  "dispute" | "fullRefund" | "partialRefund" | "chargebackDebit" | "chargebackWon" | "note" | null;

type PaymentAdjustmentPanelProps = {
  readonly paymentId: string;
  readonly invoiceCurrencyCode: string;
  readonly settlementCurrencyCode: string;
  readonly context: PaymentAdjustmentUiContext;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function impactToneClass(kind: PaymentAdjustmentUiRow["financialImpactKind"]): string {
  switch (kind) {
    case "debit":
      return "text-destructive";
    case "credit":
      return "text-success";
    case "cancelled":
      return "text-muted-foreground";
    default:
      return "text-info";
  }
}

export function PaymentAdjustmentPanel({
  paymentId,
  invoiceCurrencyCode,
  settlementCurrencyCode,
  context,
}: PaymentAdjustmentPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<ActionKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [disputeStatus, setDisputeStatus] = useState<"OPEN" | "UNDER_REVIEW">("OPEN");
  const [reason, setReason] = useState("");
  const [merchantReference, setMerchantReference] = useState("");
  const [notes, setNotes] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIsoDate());
  const [actualSettlementAmount, setActualSettlementAmount] = useState("");
  const [partialInvoiceAmount, setPartialInvoiceAmount] = useState("");
  const [chargebackStatus, setChargebackStatus] = useState<"DEBITED" | "LOST">("DEBITED");
  const [wonStatus, setWonStatus] = useState<"WON" | "REVERSED">("WON");
  const [cancelTarget, setCancelTarget] = useState<PaymentAdjustmentUiRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const { canAdjust, availableActions, adjustments } = context;

  function resetForm() {
    setDisputeStatus("OPEN");
    setReason("");
    setMerchantReference("");
    setNotes("");
    setEffectiveDate(todayIsoDate());
    setActualSettlementAmount("");
    setPartialInvoiceAmount("");
    setChargebackStatus("DEBITED");
    setWonStatus("WON");
    setError(null);
  }

  function openAction(next: ActionKind) {
    resetForm();
    setSuccess(null);
    setAction(next);
  }

  function closeAction() {
    if (pending) {
      return;
    }
    setAction(null);
    setError(null);
  }

  function submitAction(run: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setError(result.error ?? "Request failed.");
        return;
      }
      setSuccess(result.message ?? "Saved.");
      setAction(null);
      resetForm();
      router.refresh();
    });
  }

  function onConfirmAction() {
    const common = {
      reason: reason.trim() || null,
      merchantReference: merchantReference.trim() || null,
      notes: notes.trim() || null,
    };

    switch (action) {
      case "dispute":
        submitAction(() =>
          openPaymentDisputeAction(paymentId, {
            ...common,
            status: disputeStatus,
          }),
        );
        break;
      case "fullRefund":
        submitAction(() =>
          processFullRefundAction(paymentId, {
            ...common,
            effectiveDate: effectiveDate || undefined,
            actualSettlementAmount: actualSettlementAmount.trim() || null,
          }),
        );
        break;
      case "partialRefund":
        submitAction(() =>
          processPartialRefundAction(paymentId, {
            ...common,
            invoiceAmount: partialInvoiceAmount.trim(),
            effectiveDate: effectiveDate || undefined,
            actualSettlementAmount: actualSettlementAmount.trim() || null,
          }),
        );
        break;
      case "chargebackDebit":
        submitAction(() =>
          recordChargebackDebitAction(paymentId, {
            ...common,
            status: chargebackStatus,
            effectiveDate: effectiveDate || undefined,
            actualSettlementAmount: actualSettlementAmount.trim() || null,
          }),
        );
        break;
      case "chargebackWon":
        submitAction(() =>
          recordChargebackWonAction(paymentId, {
            ...common,
            status: wonStatus,
            effectiveDate: effectiveDate || undefined,
            actualSettlementAmount: actualSettlementAmount.trim() || null,
          }),
        );
        break;
      case "note":
        submitAction(() =>
          addPaymentAdjustmentNoteAction(paymentId, {
            notes: notes.trim(),
            reason: reason.trim() || null,
            merchantReference: merchantReference.trim() || null,
          }),
        );
        break;
      default:
        break;
    }
  }

  function onCancelAdjustment() {
    if (!cancelTarget) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await cancelPaymentAdjustmentAction(paymentId, cancelTarget.id, {
        reason: cancelReason.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(result.message ?? "Adjustment cancelled.");
      setCancelTarget(null);
      setCancelReason("");
      router.refresh();
    });
  }

  const dialogMeta = actionDialogMeta(action);

  return (
    <>
      <DetailSection
        title="Refund / Adjustment"
        description="Linked adjustments only. The original Successful payment financial fields are never rewritten (BR-023). Open disputes are informational until a financial debit or refund is recorded."
        actions={
          canAdjust ? (
            <div className="flex flex-wrap gap-2">
              {availableActions.dispute ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAction("dispute")}
                >
                  Mark as Dispute
                </Button>
              ) : null}
              {availableActions.fullRefund ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAction("fullRefund")}
                >
                  Full refund
                </Button>
              ) : null}
              {availableActions.partialRefund ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAction("partialRefund")}
                >
                  Partial refund
                </Button>
              ) : null}
              {availableActions.chargebackDebit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAction("chargebackDebit")}
                >
                  Chargeback debit/loss
                </Button>
              ) : null}
              {availableActions.chargebackWon ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAction("chargebackWon")}
                >
                  Chargeback won/reversal
                </Button>
              ) : null}
              {availableActions.note ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAction("note")}
                >
                  Add note
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Staff can view adjustment history. Confirmed payment mutations require Admin or
              Compliance.
            </p>
          )
        }
      >
        {success ? (
          <Alert className="mb-4">
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        {error && !action && !cancelTarget ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {adjustments.length === 0 ? (
          <EmptyState
            title="No adjustments yet"
            description="Disputes, refunds, chargebacks, and notes will appear here. Opening a dispute alone does not reduce revenue."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <StatusBadge status={row.type} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm ${impactToneClass(row.financialImpactKind)}`}>
                      {row.financialImpactLabel}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {row.invoiceAmount != null
                      ? `${row.invoiceAmount} ${invoiceCurrencyCode}`
                      : row.amount}
                    {row.settlementAmount != null ? (
                      <div className="text-muted-foreground">
                        {row.settlementAmount} {settlementCurrencyCode}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{row.effectiveDate}</TableCell>
                  <TableCell className="max-w-[12rem] truncate text-sm">
                    {row.merchantReference ?? row.reason ?? row.notes ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.canCancel ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setError(null);
                          setCancelTarget(row);
                          setCancelReason("");
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DetailSection>

      <Dialog open={action != null} onOpenChange={(open) => (!open ? closeAction() : undefined)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMeta.title}</DialogTitle>
            <DialogDescription>{dialogMeta.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {action === "dispute" ? (
              <FormField label="Dispute status" htmlFor="adj-dispute-status">
                <NativeSelect
                  id="adj-dispute-status"
                  value={disputeStatus}
                  disabled={pending}
                  onChange={(event) =>
                    setDisputeStatus(event.target.value as "OPEN" | "UNDER_REVIEW")
                  }
                >
                  <option value="OPEN">Open</option>
                  <option value="UNDER_REVIEW">Under review</option>
                </NativeSelect>
              </FormField>
            ) : null}

            {action === "chargebackDebit" ? (
              <FormField label="Chargeback status" htmlFor="adj-cb-status">
                <NativeSelect
                  id="adj-cb-status"
                  value={chargebackStatus}
                  disabled={pending}
                  onChange={(event) =>
                    setChargebackStatus(event.target.value as "DEBITED" | "LOST")
                  }
                >
                  <option value="DEBITED">Debited</option>
                  <option value="LOST">Lost</option>
                </NativeSelect>
              </FormField>
            ) : null}

            {action === "chargebackWon" ? (
              <FormField label="Won / reversal status" htmlFor="adj-won-status">
                <NativeSelect
                  id="adj-won-status"
                  value={wonStatus}
                  disabled={pending}
                  onChange={(event) => setWonStatus(event.target.value as "WON" | "REVERSED")}
                >
                  <option value="WON">Won</option>
                  <option value="REVERSED">Reversed</option>
                </NativeSelect>
              </FormField>
            ) : null}

            {action === "partialRefund" ? (
              <FormField
                label="Partial invoice amount"
                htmlFor="adj-partial-amount"
                required
                hint={`Invoice currency ${invoiceCurrencyCode}. Must not exceed remaining payment balance.`}
              >
                <Input
                  id="adj-partial-amount"
                  value={partialInvoiceAmount}
                  disabled={pending}
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(event) => setPartialInvoiceAmount(event.target.value)}
                />
              </FormField>
            ) : null}

            {action === "fullRefund" ||
            action === "partialRefund" ||
            action === "chargebackDebit" ||
            action === "chargebackWon" ? (
              <>
                <FormField label="Effective date" htmlFor="adj-effective-date">
                  <Input
                    id="adj-effective-date"
                    type="date"
                    value={effectiveDate}
                    disabled={pending}
                    onChange={(event) => setEffectiveDate(event.target.value)}
                  />
                </FormField>
                <FormField
                  label="Merchant actual settlement amount"
                  htmlFor="adj-actual-settlement"
                  hint={`Optional. Settlement currency ${settlementCurrencyCode}. When blank, the original payment rate snapshot is used (BR-025).`}
                >
                  <Input
                    id="adj-actual-settlement"
                    value={actualSettlementAmount}
                    disabled={pending}
                    inputMode="decimal"
                    placeholder="Leave blank to use payment snapshot"
                    onChange={(event) => setActualSettlementAmount(event.target.value)}
                  />
                </FormField>
              </>
            ) : null}

            <FormField label="Reason / reason code" htmlFor="adj-reason">
              <Input
                id="adj-reason"
                value={reason}
                disabled={pending}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>

            <FormField label="Merchant reference / case ID" htmlFor="adj-merchant-ref">
              <Input
                id="adj-merchant-ref"
                value={merchantReference}
                disabled={pending}
                onChange={(event) => setMerchantReference(event.target.value)}
              />
            </FormField>

            <FormField
              label={action === "note" ? "Note" : "Notes"}
              htmlFor="adj-notes"
              required={action === "note"}
            >
              <Textarea
                id="adj-notes"
                value={notes}
                disabled={pending}
                rows={4}
                onChange={(event) => setNotes(event.target.value)}
              />
            </FormField>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={closeAction}>
              Close
            </Button>
            <Button
              type="button"
              variant={dialogMeta.destructive ? "destructive" : "default"}
              disabled={pending || (action === "note" && notes.trim().length === 0)}
              onClick={onConfirmAction}
            >
              {pending ? "Working…" : dialogMeta.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelTarget != null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setCancelTarget(null);
            setCancelReason("");
            setError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel adjustment</DialogTitle>
            <DialogDescription>
              Soft-cancels the adjustment for audit. The row is retained and excluded from financial
              totals. History is never deleted.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Cancellation reason" htmlFor="adj-cancel-reason">
            <Textarea
              id="adj-cancel-reason"
              value={cancelReason}
              disabled={pending}
              rows={3}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </FormField>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setCancelTarget(null);
                setCancelReason("");
                setError(null);
              }}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={onCancelAdjustment}
            >
              {pending ? "Working…" : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function actionDialogMeta(action: ActionKind): {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
} {
  switch (action) {
    case "dispute":
      return {
        title: "Mark as Dispute",
        description:
          "Informational only. Does not deduct revenue or CB/RF until a refund or chargeback debit is recorded.",
        confirmLabel: "Open dispute",
        destructive: false,
      };
    case "fullRefund":
      return {
        title: "Record full refund",
        description:
          "Creates a financial debit linked to this payment. Original Successful amounts stay locked.",
        confirmLabel: "Record full refund",
        destructive: true,
      };
    case "partialRefund":
      return {
        title: "Record partial refund",
        description:
          "Creates a financial debit for part of the payment. Cumulative refunds cannot exceed the original payment.",
        confirmLabel: "Record partial refund",
        destructive: true,
      };
    case "chargebackDebit":
      return {
        title: "Record chargeback debit/loss",
        description:
          "Financial debit included in CB/RF on the effective date. Original Successful payment is preserved.",
        confirmLabel: "Record debit/loss",
        destructive: true,
      };
    case "chargebackWon":
      return {
        title: "Record chargeback won/reversal",
        description: "Creates a reversing adjustment. The prior debit/loss row is not edited.",
        confirmLabel: "Record won/reversal",
        destructive: false,
      };
    case "note":
      return {
        title: "Add adjustment note",
        description: "Informational note with no financial effect.",
        confirmLabel: "Add note",
        destructive: false,
      };
    default:
      return {
        title: "Adjustment",
        description: "",
        confirmLabel: "Confirm",
        destructive: false,
      };
  }
}
