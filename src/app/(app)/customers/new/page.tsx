import { redirect } from "next/navigation";

import { CustomerForm } from "@/app/(app)/customers/customer-form";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { authorizePermission } from "@/domain/authz/authorize";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCustomerFormOptions } from "@/server/customers/actions";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "customer.create").allowed) {
    redirect("/");
  }

  const options = await loadCustomerFormOptions();
  if (!options.ok) {
    redirect("/");
  }

  const requireCompany = actor?.roleCode === "STAFF" || actor?.roleCode === "COMPLIANCE";
  const defaultCompanyId =
    options.defaultCompanyId &&
    options.companies.some((company) => company.id === options.defaultCompanyId)
      ? options.defaultCompanyId
      : requireCompany
        ? (options.companies[0]?.id ?? null)
        : null;
  const initialCompanyIds = defaultCompanyId ? [defaultCompanyId] : [];

  return (
    <PageFrame width="narrow">
      <PageHeader
        title="Create customer"
        description="Customer master fields plus company linkage. Email is optional."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Customers", href: "/customers" },
          { label: "Create" },
        ]}
      />
      <Card>
        <CardContent className="pt-5">
          <CustomerForm
            submitLabel="Create customer"
            companies={options.companies}
            requireCompany={requireCompany}
            defaultValues={{
              displayName: "",
              contactPerson: "",
              customerType: "BUSINESS",
              email: "",
              phone: "",
              alternatePhone: "",
              addressLine1: "",
              addressLine2: "",
              city: "",
              region: "",
              postalCode: "",
              countryCode: "",
              taxRegistrationId: "",
              website: "",
              defaultInvoiceCurrencyCode: "",
              defaultCompanyId,
              paymentPreference: "",
              status: "ACTIVE",
              assignedStaffUserId: null,
              internalNotes: "",
              tags: [],
              companyIds: initialCompanyIds,
            }}
          />
        </CardContent>
      </Card>
    </PageFrame>
  );
}
