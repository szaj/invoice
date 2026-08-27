"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { COMPLIANCE_STATUSES, type ComplianceStatus } from "@/domain/compliance/types";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/domain/payments/types";
import {
  MONTHLY_BRAND_MATRIX_MAX_YEAR,
  MONTHLY_BRAND_MATRIX_MIN_YEAR,
} from "@/domain/reporting/types";
import { PAYMENT_METHOD_CODES, type PaymentMethodCode } from "@/domain/settlement/types";

type CompanyOption = { id: string; displayName: string };
type ReportingGroupOption = { id: string; name: string };

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  SUCCESSFUL: "Successful",
  FAILED: "Failed",
};

const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  FLAGGED: "Flagged",
};

export type MonthlyBrandMatrixFilterValues = {
  year: string;
  companyId: string;
  customerId: string;
  staffUserId: string;
  reportingGroupId: string;
  paymentStatus: PaymentStatus | "";
  paymentMethod: PaymentMethodCode | "";
  invoiceCurrency: string;
  settlementCurrency: string;
  countryCode: string;
  complianceStatus: ComplianceStatus | "";
};

export function MonthlyBrandMatrixFilters({
  initial,
  companies,
  reportingGroups,
  allowsAllCompanies,
}: {
  initial: MonthlyBrandMatrixFilterValues;
  companies: readonly CompanyOption[];
  reportingGroups: readonly ReportingGroupOption[];
  allowsAllCompanies: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (values.year.trim()) {
      params.set("year", values.year.trim());
    }
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
    if (values.paymentStatus) {
      params.set("paymentStatus", values.paymentStatus);
    }
    if (values.paymentMethod) {
      params.set("paymentMethod", values.paymentMethod);
    }
    if (values.invoiceCurrency.trim()) {
      params.set("invoiceCurrency", values.invoiceCurrency.trim().toUpperCase());
    }
    if (values.settlementCurrency.trim()) {
      params.set("settlementCurrency", values.settlementCurrency.trim().toUpperCase());
    }
    if (values.countryCode.trim()) {
      params.set("countryCode", values.countryCode.trim().toUpperCase());
    }
    if (values.complianceStatus) {
      params.set("complianceStatus", values.complianceStatus);
    }
    const query = params.toString();
    router.push(query ? `/reports/monthly-brand?${query}` : "/reports/monthly-brand");
  }

  const hasFilters =
    Boolean(values.companyId) ||
    Boolean(values.customerId.trim()) ||
    Boolean(values.staffUserId.trim()) ||
    Boolean(values.reportingGroupId) ||
    Boolean(values.paymentStatus) ||
    Boolean(values.paymentMethod) ||
    Boolean(values.invoiceCurrency.trim()) ||
    Boolean(values.settlementCurrency.trim()) ||
    Boolean(values.countryCode.trim()) ||
    Boolean(values.complianceStatus);

  return (
    <form
      onSubmit={onSubmit}
      className="border-border bg-card grid gap-4 rounded-lg border p-4"
      data-testid="monthly-brand-matrix-filters"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="monthly-brand-filter-year">Reporting year</Label>
          <Input
            id="monthly-brand-filter-year"
            type="number"
            min={MONTHLY_BRAND_MATRIX_MIN_YEAR}
            max={MONTHLY_BRAND_MATRIX_MAX_YEAR}
            value={values.year}
            onChange={(event) => setValues((prev) => ({ ...prev, year: event.target.value }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="monthly-brand-filter-company">Company</Label>
          <NativeSelect
            id="monthly-brand-filter-company"
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
            <Label htmlFor="monthly-brand-filter-reporting-group">Reporting group</Label>
            <NativeSelect
              id="monthly-brand-filter-reporting-group"
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
          <Label htmlFor="monthly-brand-filter-settlement-currency">Settlement currency</Label>
          <Input
            id="monthly-brand-filter-settlement-currency"
            value={values.settlementCurrency}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, settlementCurrency: event.target.value }))
            }
            placeholder="e.g. AED"
            maxLength={3}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="monthly-brand-filter-payment-status">Payment status</Label>
          <NativeSelect
            id="monthly-brand-filter-payment-status"
            value={values.paymentStatus}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                paymentStatus: event.target.value as PaymentStatus | "",
              }))
            }
          >
            <option value="">Any</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PAYMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="monthly-brand-filter-payment-method">Payment method</Label>
          <NativeSelect
            id="monthly-brand-filter-payment-method"
            value={values.paymentMethod}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                paymentMethod: event.target.value as PaymentMethodCode | "",
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
          <Label htmlFor="monthly-brand-filter-invoice-currency">Invoice currency</Label>
          <Input
            id="monthly-brand-filter-invoice-currency"
            value={values.invoiceCurrency}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, invoiceCurrency: event.target.value }))
            }
            placeholder="e.g. USD"
            maxLength={3}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="monthly-brand-filter-country">Country</Label>
          <Input
            id="monthly-brand-filter-country"
            value={values.countryCode}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, countryCode: event.target.value }))
            }
            placeholder="e.g. AE"
            maxLength={2}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="monthly-brand-filter-compliance">Compliance status</Label>
          <NativeSelect
            id="monthly-brand-filter-compliance"
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        {hasFilters ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/reports/monthly-brand">Clear filters</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
