import Link from "next/link";
import { redirect } from "next/navigation";

import { CustomerFinancialSummaryPanel } from "@/app/(app)/customers/[id]/customer-financial-summary-panel";
import { CustomerNotesPanel } from "@/app/(app)/customers/[id]/customer-notes-panel";
import { CustomerProfileCompanyFilter } from "@/app/(app)/customers/[id]/customer-profile-company-filter";
import { CustomerStatusControls } from "@/app/(app)/customers/[id]/customer-status-controls";
import { StatusBadge } from "@/components/data/status-badge";
import { DetailField, DetailSection } from "@/components/layout/detail";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { countryName } from "@/domain/companies/countries";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCustomerProfileForUi } from "@/server/customers/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

function PlaceholderSection({ title, message }: { title: string; message: string }) {
  return (
    <DetailSection title={title} description={message}>
      <p className="text-muted-foreground text-sm">No rows to display.</p>
    </DetailSection>
  );
}

export default async function CustomerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const paramsMap = await searchParams;
  const companyIdRaw = paramsMap.companyId;
  const companyId = typeof companyIdRaw === "string" ? companyIdRaw : undefined;

  const actor = await getRequestAuthorizationPrincipal();
  const canDelete = authorizePermission(actor, "customer.delete").allowed;
  const canComplianceReview = authorizePermission(actor, "compliance.review").allowed;
  const result = await loadCustomerProfileForUi(id, { companyId });

  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    if (result.status === 404) {
      redirect("/customers");
    }
    return (
      <PageFrame>
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </PageFrame>
    );
  }

  const profile = result.data;
  const customer = profile.customer;
  const reviewCompanyId = profile.companyFilterId ?? profile.companies[0]?.id ?? null;
  const country = customer.countryCode
    ? `${countryName(customer.countryCode) ?? customer.countryCode} (${customer.countryCode})`
    : null;
  const companyNames =
    profile.companies.length > 0
      ? profile.companies.map((company) => company.displayName).join(", ")
      : null;

  return (
    <PageFrame>
      <PageHeader
        title={customer.displayName}
        description="Customer profile. Financial, invoice, and payment history appear when those modules exist. Mixed currencies are never shown as one unlabeled total."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Customers", href: "/customers" },
          { label: customer.displayName },
        ]}
        actions={
          <>
            <StatusBadge status={customer.status} />
            {canComplianceReview && reviewCompanyId ? (
              <Button asChild variant="outline">
                <Link
                  href={`/compliance/customer/${customer.id}?companyId=${encodeURIComponent(reviewCompanyId)}`}
                >
                  Compliance review
                </Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href={`/customers/${customer.id}/edit`}>Edit</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/customers">Back to list</Link>
            </Button>
          </>
        }
      />

      <CustomerProfileCompanyFilter
        customerId={customer.id}
        companies={profile.companies}
        initialCompanyId={profile.companyFilterId ?? ""}
      />

      <DetailSection
        title="Identity"
        description="Master record fields visible for authorized companies."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Name" value={customer.displayName} />
          <DetailField label="Type" value={customer.customerType} />
          <DetailField label="Status" value={<StatusBadge status={customer.status} />} />
          <DetailField
            label="Compliance"
            value={<StatusBadge status={customer.complianceStatus} />}
          />
          <DetailField label="Contact person" value={customer.contactPerson} />
          <DetailField label="Email" value={customer.email} />
          <DetailField label="Phone" value={customer.phone} />
          <DetailField label="Alternate phone" value={customer.alternatePhone} />
          <DetailField label="Country" value={country} />
          <DetailField label="Address line 1" value={customer.addressLine1} />
          <DetailField label="Address line 2" value={customer.addressLine2} />
          <DetailField label="City" value={customer.city} />
          <DetailField label="Region / state" value={customer.region} />
          <DetailField label="Postal code" value={customer.postalCode} />
          <DetailField label="Tax / registration ID" value={customer.taxRegistrationId} />
          <DetailField label="Website" value={customer.website} />
          <DetailField
            label="Default invoice currency"
            value={customer.defaultInvoiceCurrencyCode}
          />
          <DetailField label="Payment preference" value={customer.paymentPreference} />
          <DetailField label="Authorized companies" value={companyNames} />
          <DetailField
            label="Tags"
            value={customer.tags.length > 0 ? customer.tags.join(", ") : null}
          />
          <DetailField label="Internal notes (master)" value={customer.internalNotes} />
        </dl>
        {canDelete ? (
          <div className="border-border mt-6 border-t pt-4">
            <CustomerStatusControls customerId={customer.id} status={customer.status} />
          </div>
        ) : null}
      </DetailSection>

      <CustomerFinancialSummaryPanel summary={profile.financialSummary} />
      <PlaceholderSection title="Invoices" message={profile.invoices.message} />
      <PlaceholderSection title="Payments" message={profile.payments.message} />

      <DetailSection title="Notes" description="Internal staff notes with author and timestamp.">
        <CustomerNotesPanel customerId={customer.id} notes={profile.notes.items} />
      </DetailSection>

      <DetailSection
        title="Activity"
        description={`Customer audit events for companies you can access${
          profile.companyFilterId ? " (filtered)" : ""
        }.`}
      >
        {profile.activity.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No activity recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Company</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.activity.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.occurredAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                  </TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>
                    {item.companyId
                      ? (profile.companies.find((c) => c.id === item.companyId)?.displayName ??
                        item.companyId)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DetailSection>
    </PageFrame>
  );
}
