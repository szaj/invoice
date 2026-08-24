import { redirect } from "next/navigation";

import { ManualPaymentEntryClient } from "@/app/(app)/payments/manual/manual-payment-entry-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { authorizePermission } from "@/domain/authz/authorize";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";

export const dynamic = "force-dynamic";

/**
 * Standalone Manual payment entry (TASK-051 / Screen Inventory).
 * Requires payment.manual.record and a concrete company context.
 */
export default async function ManualPaymentEntryPage() {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "payment.manual.record").allowed) {
    redirect("/");
  }

  const context = await loadCompanyContextForLayout();
  const companyId = context.selection?.kind === "company" ? context.selection.companyId : null;
  const company = companyId ? context.companies.find((row) => row.id === companyId) : null;

  return (
    <PageFrame>
      <PageHeader
        title="Manual payment"
        description="Record a payment received outside an automated gateway. Uses the existing payment domain (MANUAL method)."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Manual payment" }]}
      />

      {!companyId || !company ? (
        <Alert>
          <AlertTitle>Select a company</AlertTitle>
          <AlertDescription>
            Choose one concrete company in the header switcher before recording a manual payment.
            All Companies is reporting-only.
          </AlertDescription>
        </Alert>
      ) : (
        <ManualPaymentEntryClient companyId={companyId} companyDisplayName={company.displayName} />
      )}
    </PageFrame>
  );
}
