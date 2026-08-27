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

export type ComplianceQueueFilterValues = {
  companyId: string;
  staffUserId: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  gateway: PaymentMethodCode | "";
  currency: string;
  status: ComplianceStatus | "";
  subjectType: ComplianceReviewSubjectType | "";
};

export function ComplianceQueueFilters({
  initial,
  companies,
}: {
  initial: ComplianceQueueFilterValues;
  companies: readonly CompanyOption[];
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
    if (values.dateFrom) {
      params.set("dateFrom", values.dateFrom);
    }
    if (values.dateTo) {
      params.set("dateTo", values.dateTo);
    }
    if (values.amountMin.trim()) {
      params.set("amountMin", values.amountMin.trim());
    }
    if (values.amountMax.trim()) {
      params.set("amountMax", values.amountMax.trim());
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
    router.push(query ? `/compliance?${query}` : "/compliance");
  }

  const hasFilters = Object.values(initial).some((value) => Boolean(value));

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="compliance-filter-company">Company</Label>
        <NativeSelect
          id="compliance-filter-company"
          className="max-w-[16rem]"
          value={values.companyId}
          onChange={(event) => setValues((prev) => ({ ...prev, companyId: event.target.value }))}
        >
          <option value="">All accessible</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="compliance-filter-status">Status</Label>
        <NativeSelect
          id="compliance-filter-status"
          value={values.status}
          onChange={(event) =>
            setValues((prev) => ({
              ...prev,
              status: event.target.value as ComplianceStatus | "",
            }))
          }
        >
          <option value="">All</option>
          {COMPLIANCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="compliance-filter-subject">Subject</Label>
        <NativeSelect
          id="compliance-filter-subject"
          value={values.subjectType}
          onChange={(event) =>
            setValues((prev) => ({
              ...prev,
              subjectType: event.target.value as ComplianceReviewSubjectType | "",
            }))
          }
        >
          <option value="">All</option>
          {COMPLIANCE_REVIEW_SUBJECT_TYPES.map((type) => (
            <option key={type} value={type}>
              {SUBJECT_LABELS[type]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="compliance-filter-gateway">Gateway</Label>
        <NativeSelect
          id="compliance-filter-gateway"
          value={values.gateway}
          onChange={(event) =>
            setValues((prev) => ({
              ...prev,
              gateway: event.target.value as PaymentMethodCode | "",
            }))
          }
        >
          <option value="">All</option>
          {PAYMENT_METHOD_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="compliance-filter-currency">Currency</Label>
        <Input
          id="compliance-filter-currency"
          className="w-24 uppercase"
          maxLength={3}
          placeholder="USD"
          value={values.currency}
          onChange={(event) => setValues((prev) => ({ ...prev, currency: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="compliance-filter-date-from">Date from</Label>
        <Input
          id="compliance-filter-date-from"
          type="date"
          value={values.dateFrom}
          onChange={(event) => setValues((prev) => ({ ...prev, dateFrom: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="compliance-filter-date-to">Date to</Label>
        <Input
          id="compliance-filter-date-to"
          type="date"
          value={values.dateTo}
          onChange={(event) => setValues((prev) => ({ ...prev, dateTo: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="compliance-filter-amount-min">Amount min</Label>
        <Input
          id="compliance-filter-amount-min"
          className="w-28 font-mono"
          inputMode="decimal"
          placeholder="0.00"
          value={values.amountMin}
          onChange={(event) => setValues((prev) => ({ ...prev, amountMin: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="compliance-filter-amount-max">Amount max</Label>
        <Input
          id="compliance-filter-amount-max"
          className="w-28 font-mono"
          inputMode="decimal"
          placeholder="0.00"
          value={values.amountMax}
          onChange={(event) => setValues((prev) => ({ ...prev, amountMax: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="compliance-filter-staff">Staff user ID</Label>
        <Input
          id="compliance-filter-staff"
          className="w-64 font-mono text-xs"
          placeholder="UUID"
          value={values.staffUserId}
          onChange={(event) => setValues((prev) => ({ ...prev, staffUserId: event.target.value }))}
        />
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
      {hasFilters ? (
        <Button asChild variant="ghost">
          <Link href="/compliance">Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}
