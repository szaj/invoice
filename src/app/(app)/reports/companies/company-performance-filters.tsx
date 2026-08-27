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
  COMPANY_PERFORMANCE_DEFAULT_PAGE_SIZE,
  COMPANY_PERFORMANCE_SORT_DIRS,
  COMPANY_PERFORMANCE_SORT_FIELDS,
  type CompanyPerformanceSortDir,
  type CompanyPerformanceSortField,
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

const SORT_LABELS: Record<CompanyPerformanceSortField, string> = {
  company: "Company",
  invoiceCount: "Invoice count",
  paymentCount: "Payment count",
};

export type CompanyPerformanceFilterValues = {
  companyId: string;
  customerId: string;
  staffUserId: string;
  reportingGroupId: string;
  dateFrom: string;
  dateTo: string;
  invoiceStatus: InvoiceStatus | "";
  paymentStatus: PaymentStatus | "";
  paymentMethod: PaymentMethodCode | "";
  invoiceCurrency: string;
  settlementCurrency: string;
  countryCode: string;
  complianceStatus: ComplianceStatus | "";
  pageSize: string;
  sortBy: CompanyPerformanceSortField;
  sortDir: CompanyPerformanceSortDir;
};

export function CompanyPerformanceFilters({
  initial,
  companies,
  reportingGroups,
  allowsAllCompanies,
}: {
  initial: CompanyPerformanceFilterValues;
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
    if (values.customerId.trim()) {
      params.set("customerId", values.customerId.trim());
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
    if (values.pageSize && values.pageSize !== String(COMPANY_PERFORMANCE_DEFAULT_PAGE_SIZE)) {
      params.set("pageSize", values.pageSize);
    }
    if (values.sortBy !== "company") {
      params.set("sortBy", values.sortBy);
    }
    if (values.sortDir !== "asc") {
      params.set("sortDir", values.sortDir);
    }
    const query = params.toString();
    router.push(query ? `/reports/companies?${query}` : "/reports/companies");
  }

  const hasFilters =
    Boolean(values.companyId) ||
    Boolean(values.customerId.trim()) ||
    Boolean(values.staffUserId.trim()) ||
    Boolean(values.reportingGroupId) ||
    Boolean(values.dateFrom) ||
    Boolean(values.dateTo) ||
    Boolean(values.invoiceStatus) ||
    Boolean(values.paymentStatus) ||
    Boolean(values.paymentMethod) ||
    Boolean(values.invoiceCurrency.trim()) ||
    Boolean(values.settlementCurrency.trim()) ||
    Boolean(values.countryCode.trim()) ||
    Boolean(values.complianceStatus) ||
    values.sortBy !== "company" ||
    values.sortDir !== "asc" ||
    (values.pageSize !== "" && values.pageSize !== String(COMPANY_PERFORMANCE_DEFAULT_PAGE_SIZE));

  return (
    <form
      onSubmit={onSubmit}
      className="border-border bg-card grid gap-4 rounded-lg border p-4"
      data-testid="company-performance-filters"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="company-perf-filter-company">Company</Label>
          <NativeSelect
            id="company-perf-filter-company"
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
            <Label htmlFor="company-perf-filter-reporting-group">Reporting group</Label>
            <NativeSelect
              id="company-perf-filter-reporting-group"
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
          <Label htmlFor="company-perf-filter-date-from">Date from</Label>
          <Input
            id="company-perf-filter-date-from"
            type="date"
            value={values.dateFrom}
            onChange={(event) => setValues((prev) => ({ ...prev, dateFrom: event.target.value }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-perf-filter-date-to">Date to</Label>
          <Input
            id="company-perf-filter-date-to"
            type="date"
            value={values.dateTo}
            onChange={(event) => setValues((prev) => ({ ...prev, dateTo: event.target.value }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-perf-filter-invoice-status">Invoice status</Label>
          <NativeSelect
            id="company-perf-filter-invoice-status"
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
          <Label htmlFor="company-perf-filter-payment-status">Payment status</Label>
          <NativeSelect
            id="company-perf-filter-payment-status"
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
          <Label htmlFor="company-perf-filter-payment-method">Payment method</Label>
          <NativeSelect
            id="company-perf-filter-payment-method"
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
          <Label htmlFor="company-perf-filter-invoice-currency">Invoice currency</Label>
          <Input
            id="company-perf-filter-invoice-currency"
            value={values.invoiceCurrency}
            maxLength={3}
            placeholder="USD"
            onChange={(event) =>
              setValues((prev) => ({ ...prev, invoiceCurrency: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-perf-filter-settlement-currency">Settlement currency</Label>
          <Input
            id="company-perf-filter-settlement-currency"
            value={values.settlementCurrency}
            maxLength={3}
            placeholder="USD"
            onChange={(event) =>
              setValues((prev) => ({ ...prev, settlementCurrency: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-perf-filter-country">Country</Label>
          <Input
            id="company-perf-filter-country"
            value={values.countryCode}
            maxLength={2}
            placeholder="US"
            onChange={(event) =>
              setValues((prev) => ({ ...prev, countryCode: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-perf-filter-compliance">Compliance status</Label>
          <NativeSelect
            id="company-perf-filter-compliance"
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
          <Label htmlFor="company-perf-filter-customer">Customer ID</Label>
          <Input
            id="company-perf-filter-customer"
            value={values.customerId}
            onChange={(event) => setValues((prev) => ({ ...prev, customerId: event.target.value }))}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-perf-filter-staff">Staff user ID</Label>
          <Input
            id="company-perf-filter-staff"
            value={values.staffUserId}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, staffUserId: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-perf-filter-sort-by">Sort by</Label>
          <NativeSelect
            id="company-perf-filter-sort-by"
            value={values.sortBy}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                sortBy: event.target.value as CompanyPerformanceSortField,
              }))
            }
          >
            {COMPANY_PERFORMANCE_SORT_FIELDS.map((field) => (
              <option key={field} value={field}>
                {SORT_LABELS[field]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-perf-filter-sort-dir">Sort direction</Label>
          <NativeSelect
            id="company-perf-filter-sort-dir"
            value={values.sortDir}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                sortDir: event.target.value as CompanyPerformanceSortDir,
              }))
            }
          >
            {COMPANY_PERFORMANCE_SORT_DIRS.map((dir) => (
              <option key={dir} value={dir}>
                {dir === "asc" ? "Ascending" : "Descending"}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="company-perf-filter-page-size">Page size</Label>
          <NativeSelect
            id="company-perf-filter-page-size"
            value={values.pageSize}
            onChange={(event) => setValues((prev) => ({ ...prev, pageSize: event.target.value }))}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/reports/companies">Clear</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
