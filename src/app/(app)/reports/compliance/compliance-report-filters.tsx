"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  COMPLIANCE_REVIEW_SUBJECT_TYPES,
  COMPLIANCE_STATUSES,
  type ComplianceReviewSubjectType,
  type ComplianceStatus,
} from "@/domain/compliance/types";
import { PAYMENT_METHOD_CODES, type PaymentMethodCode } from "@/domain/settlement/types";

type CompanyOption = { id: string; displayName: string };
type ReportingGroupOption = { id: string; name: string };

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  FLAGGED: "Flagged",
};

const SUBJECT_LABELS: Record<ComplianceReviewSubjectType, string> = {
  INVOICE: "Invoice",
  PAYMENT: "Payment",
  CUSTOMER: "Customer",
};

export type ComplianceReportFilterValues = {
  companyId: string;
  staffUserId: string;
  reportingGroupId: string;
  dateFrom: string;
  dateTo: string;
  gateway: PaymentMethodCode | "";
  currency: string;
  status: ComplianceStatus | "";
  subjectType: ComplianceReviewSubjectType | "";
};

export function ComplianceReportFilters({
  initial,
  companies,
  reportingGroups,
  allowsAllCompanies,
}: {
  initial: ComplianceReportFilterValues;
  companies: readonly CompanyOption[];
  reportingGroups: readonly ReportingGroupOption[];
  allowsAllCompanies: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (values.companyId) {
      params.set("companyId", values.companyId);
    }
    if (values.staffUserId.trim()) {
      params.set("staffUserId", values.staffUserId.trim());
    }
    if (values.reportingGroupId) {
      params.set("reportingGroupId", values.reportingGroupId);
    }
    if (values.dateFrom) {
      params.set("dateFrom", values.dateFrom);
    }
    if (values.dateTo) {
      params.set("dateTo", values.dateTo);
    }
    if (values.gateway) {
      params.set("gateway", values.gateway);
    }
    if (values.currency.trim()) {
      params.set("currency", values.currency.trim().toUpperCase());
    }
    if (values.status) {
      params.set("status", values.status);
    }
    if (values.subjectType) {
      params.set("subjectType", values.subjectType);
    }
    const query = params.toString();
    router.push(query ? `/reports/compliance?${query}` : "/reports/compliance");
  }

  const hasFilters =
    Boolean(values.companyId) ||
    Boolean(values.staffUserId.trim()) ||
    Boolean(values.reportingGroupId) ||
    Boolean(values.dateFrom) ||
    Boolean(values.dateTo) ||
    Boolean(values.gateway) ||
    Boolean(values.currency.trim()) ||
    Boolean(values.status) ||
    Boolean(values.subjectType);

  return (
    <form
      onSubmit={onSubmit}
      className="border-border bg-card grid gap-4 rounded-lg border p-4"
      data-testid="compliance-report-filters"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="compliance-report-filter-company">Company</Label>
          <NativeSelect
            id="compliance-report-filter-company"
            value={values.companyId}
            onChange={(event) => setValues((prev) => ({ ...prev, companyId: event.target.value }))}
          >
            {allowsAllCompanies ? <option value="">All companies</option> : null}
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.displayName}
              </option>
            ))}
          </NativeSelect>
        </div>

        {reportingGroups.length > 0 ? (
          <div className="grid gap-2">
            <Label htmlFor="compliance-report-filter-reporting-group">Reporting group</Label>
            <NativeSelect
              id="compliance-report-filter-reporting-group"
              value={values.reportingGroupId}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, reportingGroupId: event.target.value }))
              }
            >
              <option value="">Any</option>
              {reportingGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="compliance-report-filter-date-from">Date from</Label>
          <Input
            id="compliance-report-filter-date-from"
            type="date"
            value={values.dateFrom}
            onChange={(event) => setValues((prev) => ({ ...prev, dateFrom: event.target.value }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="compliance-report-filter-date-to">Date to</Label>
          <Input
            id="compliance-report-filter-date-to"
            type="date"
            value={values.dateTo}
            onChange={(event) => setValues((prev) => ({ ...prev, dateTo: event.target.value }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="compliance-report-filter-status">Compliance status</Label>
          <NativeSelect
            id="compliance-report-filter-status"
            value={values.status}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                status: event.target.value as ComplianceStatus | "",
              }))
            }
          >
            <option value="">Any</option>
            {COMPLIANCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="compliance-report-filter-subject-type">Subject type</Label>
          <NativeSelect
            id="compliance-report-filter-subject-type"
            value={values.subjectType}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                subjectType: event.target.value as ComplianceReviewSubjectType | "",
              }))
            }
          >
            <option value="">Any</option>
            {COMPLIANCE_REVIEW_SUBJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {SUBJECT_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="compliance-report-filter-gateway">Gateway</Label>
          <NativeSelect
            id="compliance-report-filter-gateway"
            value={values.gateway}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                gateway: event.target.value as PaymentMethodCode | "",
              }))
            }
          >
            <option value="">Any</option>
            {PAYMENT_METHOD_CODES.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="compliance-report-filter-currency">Currency</Label>
          <Input
            id="compliance-report-filter-currency"
            value={values.currency}
            maxLength={3}
            placeholder="USD"
            onChange={(event) => setValues((prev) => ({ ...prev, currency: event.target.value }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="compliance-report-filter-staff">Staff user ID</Label>
          <Input
            id="compliance-report-filter-staff"
            value={values.staffUserId}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, staffUserId: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/reports/compliance">Clear</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
