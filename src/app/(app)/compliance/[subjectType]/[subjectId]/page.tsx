import Link from "next/link";
import { redirect } from "next/navigation";

import { ComplianceReviewPanel } from "@/app/(app)/compliance/[subjectType]/[subjectId]/compliance-review-panel";
import { StatusBadge } from "@/components/data/status-badge";
import { DetailField, DetailSection } from "@/components/layout/detail";
import { PageFrame } from "@/components/layout/page-frame";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authorizePermission } from "@/domain/authz/authorize";
import { parseComplianceSubjectTypeParam } from "@/domain/compliance/schema";
import type { ComplianceReviewSubjectType } from "@/domain/compliance/types";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { loadComplianceReviewForUi } from "@/server/compliance/actions";

export const dynamic = "force-dynamic";

const SUBJECT_LABELS: Record<ComplianceReviewSubjectType, string> = {
  INVOICE: "Invoice",
  PAYMENT: "Payment",
  CUSTOMER: "Customer",
};

export default async function ComplianceReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectType: string; subjectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "compliance.review").allowed) {
    redirect("/");
  }

  const { subjectType: subjectTypeParam, subjectId } = await params;
  const subjectType = parseComplianceSubjectTypeParam(subjectTypeParam);
  if (!subjectType) {
    redirect("/compliance");
  }

  const query = await searchParams;
  const companyIdRaw = query.companyId;
  const companyId =
    typeof companyIdRaw === "string" && companyIdRaw.length > 0 ? companyIdRaw : null;

  if (subjectType === "CUSTOMER" && !companyId) {
    return (
      <PageFrame>
        <Alert variant="destructive">
          <AlertDescription>
            A company context is required to review a customer. Open the record from the compliance
            queue.
          </AlertDescription>
        </Alert>
      </PageFrame>
    );
  }

  const result = await loadComplianceReviewForUi({
    subjectType,
    subjectId,
    companyId,
  });

  if (!result.ok) {
    if (result.status === 403) {
      redirect("/");
    }
    if (result.status === 404) {
      redirect("/compliance");
    }
    return (
      <PageFrame>
        <Alert variant="destructive">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </PageFrame>
    );
  }

  const { subject, notes, canReview } = result.data;
  const title = `${SUBJECT_LABELS[subject.subjectType]} review`;

  return (
    <PageFrame>
      <PageHeader
        title={title}
        description="Review this record, set compliance status, and add internal notes or reason codes."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Compliance", href: "/compliance" },
          { label: subject.label },
        ]}
        actions={
          <>
            <StatusBadge status={subject.complianceStatus} />
            <Button asChild variant="outline">
              <Link href={subject.recordHref}>Open record</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/compliance">Back to queue</Link>
            </Button>
          </>
        }
      />

      <DetailSection title="Record" description="Subject identity and current compliance status.">
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Type" value={SUBJECT_LABELS[subject.subjectType]} />
          <DetailField label="Label" value={subject.label} />
          <DetailField label="Company" value={subject.companyDisplayName} />
          <DetailField
            label="Compliance"
            value={<StatusBadge status={subject.complianceStatus} />}
          />
          <DetailField label="Date" value={subject.date} />
          <DetailField
            label="Amount"
            value={
              subject.amount && subject.currencyCode
                ? `${subject.amount} ${subject.currencyCode}`
                : subject.amount
            }
          />
          <DetailField label="Gateway" value={subject.gateway} />
          <DetailField
            label="Assigned staff"
            value={
              subject.staffUserId ? (
                <span className="font-mono text-xs">{subject.staffUserId}</span>
              ) : null
            }
          />
        </dl>
      </DetailSection>

      <ComplianceReviewPanel
        subjectType={subject.subjectType}
        subjectId={subject.subjectId}
        companyId={subject.companyId}
        currentStatus={subject.complianceStatus}
        canReview={canReview}
        notes={notes}
      />
    </PageFrame>
  );
}
