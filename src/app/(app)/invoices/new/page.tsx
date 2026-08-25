import { redirect } from "next/navigation";

import { InvoiceDraftForm } from "@/app/(app)/invoices/invoice-draft-form";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { authorizePermission } from "@/domain/authz/authorize";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadInvoiceFormOptions } from "@/server/invoices/actions";

export const dynamic = "force-dynamic";

export default async function NewInvoiceDraftPage() {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "invoice.create").allowed) {
    redirect("/");
  }

  const options = await loadInvoiceFormOptions();
  if (!options.ok || !options.defaultCompanyId) {
    redirect("/invoices");
  }

  const today = new Date().toISOString().slice(0, 10);
  const defaultCurrency = options.currencies[0]?.code ?? "";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Create draft invoice</h1>
          <CardDescription>
            Header fields only. Line items, totals, numbering, and issue/send are later tasks.
            Internal notes are never customer-visible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceDraftForm
            submitLabel="Create draft"
            companies={options.companies}
            initialCustomers={options.customers}
            initialCurrencies={options.currencies}
            defaultValues={{
              companyId: options.defaultCompanyId,
              customerId: options.customers[0]?.id ?? "",
              invoiceDate: today,
              dueDate: today,
              currencyCode: defaultCurrency,
              referencePo: "",
              assignedStaffUserId: null,
              internalNotes: "",
              customerNotes: "",
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
