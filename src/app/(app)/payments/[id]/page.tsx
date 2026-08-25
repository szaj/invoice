import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/data/status-badge";
import { DetailField, DetailSection, MetricCard } from "@/components/layout/detail";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadPaymentAdjustmentUi } from "@/server/payments/adjustment-ui-actions";

import { PaymentAdjustmentPanel } from "./payment-adjustment-panel";

export const dynamic = "force-dynamic";

function formatDate(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function moneyWithCurrency(amount: string, currencyCode: string): string {
  return `${amount} ${currencyCode}`;
}

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "invoice.create").allowed) {
    redirect("/");
  }

  const result = await loadPaymentAdjustmentUi(id);
  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    if (result.status === 404) {
      redirect("/payments");
    }
    return (
      <PageFrame>
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </PageFrame>
    );
  }

  const { payment, lifecycle, cbrfImpact } = result.data;
  const title = `Payment ${payment.id.slice(0, 8)}`;
  const rateSourceLabel =
    payment.rateSource === "SAME_CURRENCY" ? "Same currency" : "Admin fixed rate";
  const openDisputeHint =
    cbrfImpact.openDisputeAmount !== "0"
      ? `Open disputes ${moneyWithCurrency(cbrfImpact.openDisputeAmount, cbrfImpact.currencyCode)} shown separately (not deducted)`
      : "Open disputes excluded until debit/refund (BR-024)";

  return (
    <PageFrame>
      <PageHeader
        title={title}
        description="Payment detail. Confirmed financial fields are immutable; refunds, disputes, and chargebacks are linked adjustments that never rewrite the original Successful payment."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Payments", href: "/payments" },
          { label: title },
        ]}
        actions={
          <>
            <StatusBadge status={payment.status} />
            {lifecycle.dispute ? <StatusBadge status={lifecycle.dispute} /> : null}
            {lifecycle.refund ? <StatusBadge status={lifecycle.refund} /> : null}
            {lifecycle.chargeback ? <StatusBadge status={lifecycle.chargeback} /> : null}
            <Button asChild variant="outline">
              <Link href="/payments">Back to list</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Invoice amount applied"
          value={moneyWithCurrency(payment.invoiceAmountApplied, payment.invoiceCurrencyCode)}
        />
        <MetricCard
          label="Converted settlement"
          value={moneyWithCurrency(
            payment.convertedSettlementAmount,
            payment.settlementCurrencyCode,
          )}
          hint="Fee excluded (BR-020)"
        />
        <MetricCard
          label="Fixed conversion rate"
          value={payment.fixedConversionRate}
          hint={rateSourceLabel}
        />
        <MetricCard
          label="CB/RF impact"
          value={moneyWithCurrency(cbrfImpact.amount, cbrfImpact.currencyCode)}
          hint={openDisputeHint}
        />
      </div>

      <DetailSection
        title="Payment"
        description="Method, source, and references. Confirmed fields cannot be edited here."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Method" value={payment.methodCode} />
          <DetailField label="Status" value={<StatusBadge status={payment.status} />} />
          <DetailField
            label="Compliance"
            value={<StatusBadge status={payment.complianceStatus} />}
          />
          <DetailField label="Source" value={payment.source} />
          <DetailField label="Payment date" value={formatDate(payment.paymentDate)} />
          <DetailField label="Received at" value={formatDateTime(payment.receivedAt)} />
          <DetailField
            label="External transaction ID"
            value={
              payment.externalTransactionId ? (
                <span className="font-mono text-xs break-all">{payment.externalTransactionId}</span>
              ) : null
            }
          />
          <DetailField label="Company" value={payment.companyDisplayName} />
          <DetailField
            label="Invoice"
            value={
              <Link
                href={`/invoices/${payment.invoiceId}`}
                className="text-foreground font-medium underline-offset-4 hover:underline"
              >
                {payment.invoiceLabel}
              </Link>
            }
          />
          <DetailField
            label="Customer"
            value={
              payment.customerDisplayName ? (
                <Link
                  href={`/customers/${payment.customerId}`}
                  className="text-foreground font-medium underline-offset-4 hover:underline"
                >
                  {payment.customerDisplayName}
                </Link>
              ) : (
                payment.customerId.slice(0, 8)
              )
            }
          />
          <DetailField label="Notes" value={payment.notes} className="sm:col-span-2" />
        </dl>
      </DetailSection>

      <DetailSection
        title="Settlement conversion snapshot"
        description="Locked Admin fixed-rate snapshot. Historical payments never recalculate from today's rates (BR-020 / BR-021)."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Invoice currency" value={payment.invoiceCurrencyCode} />
          <DetailField
            label="Invoice amount applied"
            value={
              <span className="font-mono tabular-nums">
                {moneyWithCurrency(payment.invoiceAmountApplied, payment.invoiceCurrencyCode)}
              </span>
            }
          />
          <DetailField label="Settlement currency" value={payment.settlementCurrencyCode} />
          <DetailField
            label="Converted settlement"
            value={
              <span className="font-mono tabular-nums">
                {moneyWithCurrency(
                  payment.convertedSettlementAmount,
                  payment.settlementCurrencyCode,
                )}
              </span>
            }
          />
          <DetailField
            label="Fixed conversion rate"
            value={<span className="font-mono tabular-nums">{payment.fixedConversionRate}</span>}
          />
          <DetailField label="Rate source" value={rateSourceLabel} />
          <DetailField label="Rate effective at" value={formatDateTime(payment.rateEffectiveAt)} />
          <DetailField
            label="Rate version ID"
            value={
              payment.rateVersionId ? (
                <span className="font-mono text-xs break-all">{payment.rateVersionId}</span>
              ) : null
            }
          />
        </dl>
      </DetailSection>

      <DetailSection
        title="Reconciliation (optional)"
        description="Processor fee and actual received are independent fields. They do not change converted settlement or invoice balance (BR-020)."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField
            label="Processor / merchant fee"
            value={
              payment.processorFeeAmount != null ? (
                <span className="font-mono tabular-nums">
                  {moneyWithCurrency(payment.processorFeeAmount, payment.settlementCurrencyCode)}
                </span>
              ) : null
            }
          />
          <DetailField
            label="Actual amount received"
            value={
              payment.actualReceivedAmount != null ? (
                <span className="font-mono tabular-nums">
                  {moneyWithCurrency(payment.actualReceivedAmount, payment.settlementCurrencyCode)}
                </span>
              ) : null
            }
          />
        </dl>
      </DetailSection>

      {payment.status === "SUCCESSFUL" || result.data.adjustments.length > 0 ? (
        <PaymentAdjustmentPanel
          paymentId={payment.id}
          invoiceCurrencyCode={payment.invoiceCurrencyCode}
          settlementCurrencyCode={payment.settlementCurrencyCode}
          context={result.data}
        />
      ) : null}
    </PageFrame>
  );
}
