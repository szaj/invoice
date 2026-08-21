import { redirect } from "next/navigation";

import { CustomerForm } from "@/app/(app)/customers/customer-form";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCustomerForUi, loadCustomerFormOptions } from "@/server/customers/actions";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getRequestAuthorizationPrincipal();
  const [result, options] = await Promise.all([loadCustomerForUi(id), loadCustomerFormOptions()]);

  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    if (result.status === 404) {
      redirect("/customers");
    }
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-destructive text-sm">{result.error}</p>
      </main>
    );
  }

  if (!options.ok) {
    redirect("/");
  }

  const customer = result.data;
  const requireCompany = actor?.roleCode === "STAFF" || actor?.roleCode === "COMPLIANCE";
  const accessibleIds = new Set(options.companies.map((company) => company.id));
  const editableCompanyIds = customer.companyIds.filter((id) => accessibleIds.has(id));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <Card>
        <CardHeader className="grid gap-2">
          <h1 className="text-lg font-semibold">Edit customer</h1>
          <CardDescription>
            Updates go through the customer service. Company links you cannot access are preserved.
            Soft-deactivate is Admin-only on the customer detail page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerForm
            customerId={customer.id}
            submitLabel="Save changes"
            companies={options.companies}
            requireCompany={requireCompany}
            defaultValues={{
              displayName: customer.displayName,
              contactPerson: customer.contactPerson ?? "",
              customerType: customer.customerType,
              email: customer.email ?? "",
              phone: customer.phone ?? "",
              alternatePhone: customer.alternatePhone ?? "",
              addressLine1: customer.addressLine1 ?? "",
              addressLine2: customer.addressLine2 ?? "",
              city: customer.city ?? "",
              region: customer.region ?? "",
              postalCode: customer.postalCode ?? "",
              countryCode: customer.countryCode ?? "",
              taxRegistrationId: customer.taxRegistrationId ?? "",
              website: customer.website ?? "",
              defaultInvoiceCurrencyCode: customer.defaultInvoiceCurrencyCode ?? "",
              defaultCompanyId: customer.defaultCompanyId,
              paymentPreference: customer.paymentPreference ?? "",
              status: customer.status,
              assignedStaffUserId: customer.assignedStaffUserId,
              internalNotes: customer.internalNotes ?? "",
              tags: [...customer.tags],
              companyIds: editableCompanyIds,
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
