"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { COMPLIANCE_STATUSES, type ComplianceStatus } from "@/domain/compliance/types";

type CompanyOption = { id: string; displayName: string };
type ReportingGroupOption = { id: string; name: string };

const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  FLAGGED: "Flagged",
};

export type OverdueAgingFilterValues = {
  companyId: string;
  customerId: string;
  staffUserId: string;
  reportingGroupId: string;
  invoiceCurrency: string;
  countryCode: string;
  complianceStatus: ComplianceStatus | "";
};

export function OverdueAgingFilters({
  initial,
  companies,
  reportingGroups,
  allowsAllCompanies,
}: {
  initial: OverdueAgingFilterValues;
  companies: readonly CompanyOption[];
  reportingGroups: readonly ReportingGroupOption[];
  allowsAllCompanies: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (values.companyId) {
      params.set("companyId", values.companyId);
    }
    if (values.customerId.trim()) {
      params.set("customerId", values.customerId.trim());
    }
    if (values.staffUserId.trim()) {
      params.set("staffUserId", values.staffUserId.trim());
    }
    if (values.reportingGroupId) {
      params.set("reportingGroupId", values.reportingGroupId);
    }
    if (values.invoiceCurrency.trim()) {
      params.set("invoiceCurrency", values.invoiceCurrency.trim().toUpperCase());
    }
    if (values.countryCode.trim()) {
      params.set("countryCode", values.countryCode.trim().toUpperCase());
    }
    if (values.complianceStatus) {
      params.set("complianceStatus", values.complianceStatus);
    }
    const query = params.toString();
    router.push(query ? `/reports/overdue-aging?${query}` : "/reports/overdue-aging");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card grid gap-4 rounded-lg border p-4"
      data-testid="overdue-aging-filters"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="overdue-aging-company">Company</Label>
          <NativeSelect
            id="overdue-aging-company"
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
        <div className="grid gap-2">
          <Label htmlFor="overdue-aging-group">Reporting group</Label>
          <NativeSelect
            id="overdue-aging-group"
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
        <div className="grid gap-2">
          <Label htmlFor="overdue-aging-compliance">Compliance</Label>
          <NativeSelect
            id="overdue-aging-compliance"
            value={values.complianceStatus}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                complianceStatus: event.target.value as ComplianceStatus | "",
              }))
            }
          >
            <option value="">Any</option>
            {COMPLIANCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {COMPLIANCE_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="overdue-aging-currency">Invoice currency</Label>
          <Input
            id="overdue-aging-currency"
            value={values.invoiceCurrency}
            maxLength={3}
            placeholder="USD"
            onChange={(event) =>
              setValues((prev) => ({ ...prev, invoiceCurrency: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="overdue-aging-country">Country</Label>
          <Input
            id="overdue-aging-country"
            value={values.countryCode}
            maxLength={2}
            placeholder="US"
            onChange={(event) =>
              setValues((prev) => ({ ...prev, countryCode: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="overdue-aging-customer">Customer ID</Label>
          <Input
            id="overdue-aging-customer"
            value={values.customerId}
            onChange={(event) => setValues((prev) => ({ ...prev, customerId: event.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="overdue-aging-staff">Staff user ID</Label>
          <Input
            id="overdue-aging-staff"
            value={values.staffUserId}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, staffUserId: event.target.value }))
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/reports/overdue-aging">Clear</Link>
        </Button>
      </div>
    </form>
  );
}
