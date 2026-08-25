import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authorizePermission } from "@/domain/authz/authorize";
import { canIssueDraftInvoice, canStaffEditDraftInvoice } from "@/domain/invoices/access";
import { canCancelInvoiceStatus, isCollectibleInvoiceStatus } from "@/domain/invoices/cancellation";
import { toDateInputValue } from "@/domain/invoices/schema";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCustomerForUi } from "@/server/customers/actions";
import {
  loadDraftInvoiceForUi,
  loadInvoiceCurrencyPrecision,
  loadInvoiceEmailComposeForUi,
  loadInvoiceEmailLogsForUi,
  loadInvoiceFormOptions,
  loadInvoiceLineItemsForUi,
  loadInvoicePdfFilesForUi,
  loadInvoiceVersionsForUi,
} from "@/server/invoices/actions";
import { loadManualPaymentFormContext, loadInvoicePaymentsForUi } from "@/server/payments/actions";
import { InvoiceCancelControls } from "@/app/(app)/invoices/invoice-cancel-controls";
import { InvoiceDuplicateButton } from "@/app/(app)/invoices/invoice-duplicate-button";
import { InvoiceEmailPanel } from "@/app/(app)/invoices/invoice-email-panel";
import { InvoiceIssueButton } from "@/app/(app)/invoices/invoice-issue-button";
import { InvoiceLineItemsEditor } from "@/app/(app)/invoices/invoice-line-items-editor";
import { InvoicePdfPanel } from "@/app/(app)/invoices/invoice-pdf-panel";
import { InvoiceTotalsPanel } from "@/app/(app)/invoices/invoice-totals-panel";
import { InvoiceVersionHistoryPanel } from "@/app/(app)/invoices/invoice-version-history-panel";
import { IssuedInvoiceMetadataForm } from "@/app/(app)/invoices/issued-invoice-metadata-form";
import { InvoicePaymentsPanel } from "@/app/(app)/payments/invoice-payments-panel";
import { InvoiceRecordPaymentPanel } from "@/app/(app)/payments/invoice-record-payment-panel";
import { StatusBadge } from "@/components/data/status-badge";
import { DetailField, DetailSection } from "@/components/layout/detail";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function InvoiceDraftViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "invoice.create").allowed) {
    redirect("/");
  }

  const result = await loadDraftInvoiceForUi(id);
  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    if (result.status === 404) {
      redirect("/invoices");
    }
    return (
      <PageFrame>
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </PageFrame>
    );
  }

  const invoice = result.data;
  const [
    options,
    customerResult,
    lineItemsResult,
    decimalPrecision,
    versionsResult,
    pdfFilesResult,
    emailLogsResult,
    emailComposeResult,
    manualPaymentContextResult,
    invoicePaymentsResult,
  ] = await Promise.all([
    loadInvoiceFormOptions(invoice.companyId),
    loadCustomerForUi(invoice.customerId),
    loadInvoiceLineItemsForUi(invoice.id),
    loadInvoiceCurrencyPrecision(invoice.currencyCode),
    loadInvoiceVersionsForUi(invoice.id),
    loadInvoicePdfFilesForUi(invoice.id),
    loadInvoiceEmailLogsForUi(invoice.id),
    loadInvoiceEmailComposeForUi(invoice.id),
    authorizePermission(actor, "payment.manual.record").allowed &&
    isCollectibleInvoiceStatus(invoice.status)
      ? loadManualPaymentFormContext(invoice.id)
      : Promise.resolve(null),
    loadInvoicePaymentsForUi(invoice.id),
  ]);
  const companyName = options.ok
    ? (options.companies.find((company) => company.id === invoice.companyId)?.displayName ??
      invoice.companyId)
    : invoice.companyId;
  const customerName = customerResult.ok
    ? customerResult.data.displayName
    : invoice.customerId.slice(0, 8);
  const lineItems = lineItemsResult.ok ? lineItemsResult.data : [];
  const versions = versionsResult.ok ? versionsResult.data : [];
  const pdfFiles = pdfFilesResult.ok ? pdfFilesResult.data : [];
  const emailLogs = emailLogsResult.ok ? emailLogsResult.data : [];
  const emailCompose = emailComposeResult.ok ? emailComposeResult.data : null;
  const emailComposeError = emailComposeResult.ok ? null : emailComposeResult.error;
  const canEdit =
    authorizePermission(actor, "invoice.edit_draft").allowed &&
    actor != null &&
    canStaffEditDraftInvoice(actor, invoice);
  const canIssue =
    authorizePermission(actor, "invoice.edit_draft").allowed &&
    actor != null &&
    canIssueDraftInvoice(actor, invoice);
  const canEditIssuedMetadata =
    invoice.status !== "DRAFT" &&
    invoice.status !== "CANCELLED" &&
    authorizePermission(actor, "invoice.edit_issued").allowed;
  const canCancel =
    authorizePermission(actor, "invoice.cancel").allowed && canCancelInvoiceStatus(invoice.status);
  const canRecordPayment = authorizePermission(actor, "payment.manual.record").allowed;
  const collectible = isCollectibleInvoiceStatus(invoice.status);
  const manualPaymentContext =
    manualPaymentContextResult && manualPaymentContextResult.ok
      ? manualPaymentContextResult.data
      : null;
  const manualPaymentContextError =
    canRecordPayment && collectible && manualPaymentContextResult && !manualPaymentContextResult.ok
      ? manualPaymentContextResult.error
      : null;
  const invoicePayments =
    invoicePaymentsResult.ok && invoicePaymentsResult.data
      ? invoicePaymentsResult.data.payments
      : [];

  const title = invoice.invoiceNumber ?? `Draft ${invoice.id.slice(0, 8)}`;
  const description =
    invoice.status === "DRAFT"
      ? "Draft invoice. Issue when ready."
      : invoice.status === "CANCELLED"
        ? "Cancelled. History, number, and financial totals are preserved; this invoice is not collectible."
        : `Status: ${invoice.status}. Financial edits of issued invoices are blocked while ADR-009 is open.`;

  return (
    <PageFrame>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Invoices", href: "/invoices" },
          { label: title },
        ]}
        actions={
          <>
            <StatusBadge status={invoice.status} />
            {canEdit ? (
              <Button asChild>
                <Link href={`/invoices/${invoice.id}/edit`}>Edit draft</Link>
              </Button>
            ) : null}
            {canIssue ? <InvoiceIssueButton invoiceId={invoice.id} /> : null}
            <InvoiceDuplicateButton invoiceId={invoice.id} />
            {canCancel ? <InvoiceCancelControls invoiceId={invoice.id} /> : null}
            <Button asChild variant="outline">
              <Link href="/invoices">Back to list</Link>
            </Button>
          </>
        }
      />

      <DetailSection title="Header" description="Company, customer, dates, and currency.">
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Company" value={companyName} />
          <DetailField label="Customer" value={customerName} />
          <DetailField label="Invoice date" value={toDateInputValue(invoice.invoiceDate)} />
          <DetailField label="Due date" value={toDateInputValue(invoice.dueDate)} />
          <DetailField label="Currency" value={invoice.currencyCode} />
          <DetailField label="Reference / PO" value={invoice.referencePo} />
          <DetailField label="Status" value={<StatusBadge status={invoice.status} />} />
          <DetailField
            label="Compliance"
            value={<StatusBadge status={invoice.complianceStatus} />}
          />
          <DetailField
            label="Invoice number"
            value={invoice.invoiceNumber ?? "Assigned on issue (system-generated, read-only)"}
          />
          {invoice.status === "CANCELLED" ? (
            <DetailField label="Cancellation reason" value={invoice.cancellationReason} />
          ) : null}
        </dl>
      </DetailSection>

      <DetailSection
        title="Internal notes"
        description="Internal only — never presented as customer-visible, and never printed or emailed."
      >
        <p className="text-sm whitespace-pre-wrap">
          {invoice.internalNotes && invoice.internalNotes.length > 0 ? invoice.internalNotes : "—"}
        </p>
      </DetailSection>

      <DetailSection
        title="Customer notes"
        description="Optional notes that may appear on the invoice later."
      >
        <p className="text-sm whitespace-pre-wrap">
          {invoice.customerNotes && invoice.customerNotes.length > 0 ? invoice.customerNotes : "—"}
        </p>
      </DetailSection>

      <DetailSection title="Line items" description="Server-calculated line totals.">
        <InvoiceLineItemsEditor
          invoiceId={invoice.id}
          currencyCode={invoice.currencyCode}
          decimalPrecision={decimalPrecision}
          initialItems={lineItems}
          readOnly
        />
      </DetailSection>

      <DetailSection
        title="Totals"
        description="Server-stored totals recalculated from line items. Paid/outstanding follow BR-009."
      >
        <InvoiceTotalsPanel
          currencyCode={invoice.currencyCode}
          subtotal={invoice.subtotal}
          discountTotal={invoice.discountTotal}
          taxTotal={invoice.taxTotal}
          invoiceTotal={invoice.invoiceTotal}
          confirmedPaidAmount={invoice.confirmedPaidAmount}
          outstandingAmount={invoice.outstandingAmount}
        />
      </DetailSection>

      <InvoiceVersionHistoryPanel versions={versions} />

      <InvoicePdfPanel
        key={`pdf-${pdfFiles.map((file) => file.id).join(",")}`}
        invoiceId={invoice.id}
        invoiceStatus={invoice.status}
        versions={versions}
        initialFiles={pdfFiles}
      />

      <InvoiceEmailPanel
        key={`email-${emailLogs.map((log) => log.id).join(",")}`}
        invoiceId={invoice.id}
        invoiceStatus={invoice.status}
        compose={emailCompose}
        composeError={emailComposeError}
        initialLogs={emailLogs}
      />

      <InvoicePaymentsPanel payments={invoicePayments} invoiceCurrencyCode={invoice.currencyCode} />

      <InvoiceRecordPaymentPanel
        canRecord={canRecordPayment}
        collectible={collectible}
        context={manualPaymentContext ?? null}
        contextError={manualPaymentContextError}
      />

      {canEditIssuedMetadata ? (
        <DetailSection
          title="Issued metadata"
          description="Admin/Compliance only. Financial fields remain immutable while ADR-009 is open."
        >
          <IssuedInvoiceMetadataForm
            invoiceId={invoice.id}
            defaultValues={{
              referencePo: invoice.referencePo ?? "",
              assignedStaffUserId: invoice.assignedStaffUserId ?? "",
              internalNotes: invoice.internalNotes ?? "",
              customerNotes: invoice.customerNotes ?? "",
            }}
          />
        </DetailSection>
      ) : null}
    </PageFrame>
  );
}
