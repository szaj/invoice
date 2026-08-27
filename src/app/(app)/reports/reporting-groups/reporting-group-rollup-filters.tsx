"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { COMPLIANCE_STATUSES, type ComplianceStatus } from "@/domain/compliance/types";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/domain/invoices/types";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/domain/payments/types";
import {
  MONTHLY_BRAND_MATRIX_MAX_YEAR,
  MONTHLY_BRAND_MATRIX_MIN_YEAR,
} from "@/domain/reporting/types";
import { PAYMENT_METHOD_CODES, type PaymentMethodCode } from "@/domain/settlement/types";

type CompanyOption = { id: string; displayName: string };
type ReportingGroupOption = { id: string; name: string };

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

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

export type ReportingGroupRollupFilterValues = {
  year: string;
  reportingGroupId: string;
  companyId: string;
  customerId: string;
  staffUserId: string;
  dateFrom: string;
  dateTo: string;
  invoiceStatus: InvoiceStatus | "";
  paymentStatus: PaymentStatus | "";
  paymentMethod: PaymentMethodCode | "";
  invoiceCurrency: string;
  settlementCurrency: string;
  countryCode: string;
  complianceStatus: ComplianceStatus | "";
};

export function ReportingGroupRollupFilters({
  initial,
  companies,
  reportingGroups,
  allowsAllCompanies,
}: {
  initial: ReportingGroupRollupFilterValues;
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
    if (values.reportingGroupId) {
      params.set("reportingGroupId", values.reportingGroupId);
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
    if (values.dateFrom) {
      params.set("dateFrom", values.dateFrom);
    }
    if (values.dateTo) {
      params.set("dateTo", values.dateTo);
    }
    if (values.invoiceStatus) {
      params.set("invoiceStatus", values.invoiceStatus);
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
    router.push(query ? `/reports/reporting-groups?${query}` : "/reports/reporting-groups");
  }

  const hasFilters = Object.values(initial).some((value) => Boolean(value));

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={onSubmit}
      data-testid="reporting-group-rollup-filters"
    >
      <div className="grid gap-2">
        <Label htmlFor="rollup-filter-year">Reporting year</Label>
        <Input
          id="rollup-filter-year"
          type="number"
          min={MONTHLY_BRAND_MATRIX_MIN_YEAR}
          max={MONTHLY_BRAND_MATRIX_MAX_YEAR}
          value={values.year}
          onChange={(event) => setValues((prev) => ({ ...prev, year: event.target.value }))}
        />
      </div>

      {reportingGroups.length > 0 ? (
        <div className="grid gap-2">
          <Label htmlFor="rollup-filter-reporting-group">Reporting group</Label>
          <NativeSelect
            id="rollup-filter-reporting-group"
            value={values.reportingGroupId}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, reportingGroupId: event.target.value }))
            }
          >
            <option value="">All groups</option>
            {reportingGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="rollup-filter-company">Company / brand</Label>
        <NativeSelect
          id="rollup-filter-company"
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
        <Label htmlFor="rollup-filter-date-from">Date from</Label>
        <Input
          id="rollup-filter-date-from"
          type="date"
          value={values.dateFrom}
          onChange={(event) => setValues((prev) => ({ ...prev, dateFrom: event.target.value }))}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rollup-filter-date-to">Date to</Label>
        <Input
          id="rollup-filter-date-to"
          type="date"
          value={values.dateTo}
          onChange={(event) => setValues((prev) => ({ ...prev, dateTo: event.target.value }))}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rollup-filter-invoice-status">Invoice status</Label>
        <NativeSelect
          id="rollup-filter-invoice-status"
          value={values.invoiceStatus}
          onChange={(event) =>
            setValues((prev) => ({
              ...prev,
              invoiceStatus: event.target.value as InvoiceStatus | "",
            }))
          }
        >
          <option value="">Any</option>
          {INVOICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {INVOICE_STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rollup-filter-payment-status">Payment status</Label>
        <NativeSelect
          id="rollup-filter-payment-status"
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
        <Label htmlFor="rollup-filter-payment-method">Payment method</Label>
        <NativeSelect
          id="rollup-filter-payment-method"
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
        <Label htmlFor="rollup-filter-invoice-currency">Invoice currency</Label>
        <Input
          id="rollup-filter-invoice-currency"
          value={values.invoiceCurrency}
          maxLength={3}
          placeholder="USD"
          onChange={(event) =>
            setValues((prev) => ({ ...prev, invoiceCurrency: event.target.value }))
          }
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rollup-filter-settlement-currency">Settlement currency</Label>
        <Input
          id="rollup-filter-settlement-currency"
          value={values.settlementCurrency}
          maxLength={3}
          placeholder="USD"
          onChange={(event) =>
            setValues((prev) => ({ ...prev, settlementCurrency: event.target.value }))
          }
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rollup-filter-country">Country</Label>
        <Input
          id="rollup-filter-country"
          value={values.countryCode}
          maxLength={2}
          placeholder="US"
          onChange={(event) => setValues((prev) => ({ ...prev, countryCode: event.target.value }))}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rollup-filter-compliance">Compliance status</Label>
        <NativeSelect
          id="rollup-filter-compliance"
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
        <Label htmlFor="rollup-filter-customer">Customer ID</Label>
        <Input
          id="rollup-filter-customer"
          value={values.customerId}
          placeholder="UUID"
          onChange={(event) => setValues((prev) => ({ ...prev, customerId: event.target.value }))}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rollup-filter-staff">Staff user ID</Label>
        <Input
          id="rollup-filter-staff"
          value={values.staffUserId}
          placeholder="UUID"
          onChange={(event) => setValues((prev) => ({ ...prev, staffUserId: event.target.value }))}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        {hasFilters ? (
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/reports/reporting-groups">Clear</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
