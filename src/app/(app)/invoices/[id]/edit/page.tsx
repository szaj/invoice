import { redirect } from "next/navigation";

import { InvoiceDraftForm } from "@/app/(app)/invoices/invoice-draft-form";
import { InvoiceLineItemsEditor } from "@/app/(app)/invoices/invoice-line-items-editor";
import { InvoiceTotalsPanel } from "@/app/(app)/invoices/invoice-totals-panel";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { authorizePermission } from "@/domain/authz/authorize";
import { canStaffEditDraftInvoice } from "@/domain/invoices/access";
import { toDateInputValue } from "@/domain/invoices/schema";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  loadDraftInvoiceForUi,
  loadInvoiceCurrencyPrecision,
  loadInvoiceFormOptions,
  loadInvoiceLineItemsForUi,
} from "@/server/invoices/actions";

export const dynamic = "force-dynamic";

export default async function EditInvoiceDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "invoice.edit_draft").allowed) {
    redirect("/");
  }

  const result = await loadDraftInvoiceForUi(id);
  if (!result.ok) {
    if (result.status === 403 || result.status === 404) {
      redirect("/invoices");
    }
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-destructive text-sm">{result.error}</p>
      </main>
    );
  }

  const invoice = result.data;
  if (invoice.status !== "DRAFT" || !actor || !canStaffEditDraftInvoice(actor, invoice)) {
    redirect(`/invoices/${invoice.id}`);
  }

  const [options, lineItemsResult, decimalPrecision] = await Promise.all([
    loadInvoiceFormOptions(invoice.companyId),
    loadInvoiceLineItemsForUi(invoice.id),
    loadInvoiceCurrencyPrecision(invoice.currencyCode),
  ]);
  if (!options.ok) {
    redirect(`/invoices/${invoice.id}`);
  }
  const lineItems = lineItemsResult.ok ? lineItemsResult.data : [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Edit draft invoice</h1>
          <CardDescription>
            Header and line items. Issued financial fields cannot be edited here. Internal notes are
            never customer-visible. Discounts are blocked until ADR-010.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceDraftForm
            invoiceId={invoice.id}
            submitLabel="Save draft"
            companies={options.companies}
            initialCustomers={options.customers}
            initialCurrencies={options.currencies}
            defaultValues={{
              companyId: invoice.companyId,
              customerId: invoice.customerId,
              invoiceDate: toDateInputValue(invoice.invoiceDate),
              dueDate: toDateInputValue(invoice.dueDate),
              currencyCode: invoice.currencyCode,
              referencePo: invoice.referencePo ?? "",
              assignedStaffUserId: invoice.assignedStaffUserId,
              internalNotes: invoice.internalNotes ?? "",
              customerNotes: invoice.customerNotes ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="grid gap-2">
          <h2 className="text-base font-semibold">Line items</h2>
          <CardDescription>
            Quantity must be greater than zero. Line totals are calculated server-side. Saving lines
            recalculates invoice totals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceLineItemsEditor
            invoiceId={invoice.id}
            currencyCode={invoice.currencyCode}
            decimalPrecision={decimalPrecision}
            initialItems={lineItems}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="grid gap-2">
          <h2 className="text-base font-semibold">Totals</h2>
          <CardDescription>
            Display-only. Recalculated when line items are saved. Discount remains 0 while ADR-010
            is OPEN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceTotalsPanel
            currencyCode={invoice.currencyCode}
            subtotal={invoice.subtotal}
            discountTotal={invoice.discountTotal}
            taxTotal={invoice.taxTotal}
            invoiceTotal={invoice.invoiceTotal}
            confirmedPaidAmount={invoice.confirmedPaidAmount}
            outstandingAmount={invoice.outstandingAmount}
          />
        </CardContent>
      </Card>
    </main>
  );
}
