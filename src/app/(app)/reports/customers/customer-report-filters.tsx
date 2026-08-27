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
import {
  CUSTOMER_REPORT_DEFAULT_PAGE_SIZE,
  CUSTOMER_REPORT_SORT_DIRS,
  CUSTOMER_REPORT_SORT_FIELDS,
  type CustomerReportSortDir,
  type CustomerReportSortField,
} from "@/domain/reporting/types";

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

const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  FLAGGED: "Flagged",
};

const SORT_LABELS: Record<CustomerReportSortField, string> = {
  customer: "Customer",
  currency: "Currency",
  invoiced: "Total invoiced",
  paid: "Total paid",
  outstanding: "Outstanding",
  invoiceCount: "Invoice count",
};

export type CustomerReportFilterValues = {
  companyId: string;
  customerId: string;
  staffUserId: string;
  reportingGroupId: string;
  dateFrom: string;
  dateTo: string;
  invoiceStatus: InvoiceStatus | "";
  invoiceCurrency: string;
  countryCode: string;
  complianceStatus: ComplianceStatus | "";
  pageSize: string;
  sortBy: CustomerReportSortField;
  sortDir: CustomerReportSortDir;
};

export function CustomerReportFilters({
  initial,
  companies,
  reportingGroups,
  allowsAllCompanies,
}: {
  initial: CustomerReportFilterValues;
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
    if (values.invoiceCurrency.trim()) {
      params.set("invoiceCurrency", values.invoiceCurrency.trim().toUpperCase());
    }
    if (values.countryCode.trim()) {
      params.set("countryCode", values.countryCode.trim().toUpperCase());
    }
    if (values.complianceStatus) {
      params.set("complianceStatus", values.complianceStatus);
    }
    if (values.pageSize && values.pageSize !== String(CUSTOMER_REPORT_DEFAULT_PAGE_SIZE)) {
      params.set("pageSize", values.pageSize);
    }
    if (values.sortBy !== "customer") {
      params.set("sortBy", values.sortBy);
    }
    if (values.sortDir !== "asc") {
      params.set("sortDir", values.sortDir);
    }
    const query = params.toString();
    router.push(query ? `/reports/customers?${query}` : "/reports/customers");
  }

  const hasFilters =
    Boolean(initial.companyId) ||
    Boolean(initial.customerId) ||
    Boolean(initial.staffUserId) ||
    Boolean(initial.reportingGroupId) ||
    Boolean(initial.dateFrom) ||
    Boolean(initial.dateTo) ||
    Boolean(initial.invoiceStatus) ||
    Boolean(initial.invoiceCurrency) ||
    Boolean(initial.countryCode) ||
    Boolean(initial.complianceStatus) ||
    initial.sortBy !== "customer" ||
    initial.sortDir !== "asc" ||
    (initial.pageSize !== "" && initial.pageSize !== String(CUSTOMER_REPORT_DEFAULT_PAGE_SIZE));

  return (
    <form className="grid gap-3" onSubmit={onSubmit} data-testid="customer-report-filters">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="customer-report-company">Company</Label>
          <NativeSelect
            id="customer-report-company"
            value={values.companyId}
            onChange={(event) => setValues((prev) => ({ ...prev, companyId: event.target.value }))}
          >
            <option value="">
              {allowsAllCompanies
                ? "All companies"
                : companies.length === 1
                  ? (companies[0]?.displayName ?? "Company")
                  : "Select company"}
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.displayName}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer-report-group">Reporting group</Label>
          <NativeSelect
            id="customer-report-group"
            value={values.reportingGroupId}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, reportingGroupId: event.target.value }))
            }
          >
            <option value="">Any group</option>
            {reportingGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer-report-status">Invoice status</Label>
          <NativeSelect
            id="customer-report-status"
            value={values.invoiceStatus}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                invoiceStatus: event.target.value as InvoiceStatus | "",
              }))
            }
          >
            <option value="">Any collectible</option>
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {INVOICE_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer-report-compliance">Compliance</Label>
          <NativeSelect
            id="customer-report-compliance"
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="customer-report-date-from">Invoice date from</Label>
          <Input
            id="customer-report-date-from"
            type="date"
            value={values.dateFrom}
            onChange={(event) => setValues((prev) => ({ ...prev, dateFrom: event.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer-report-date-to">Invoice date to</Label>
          <Input
            id="customer-report-date-to"
            type="date"
            value={values.dateTo}
            onChange={(event) => setValues((prev) => ({ ...prev, dateTo: event.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer-report-currency">Invoice currency</Label>
          <Input
            id="customer-report-currency"
            placeholder="USD"
            maxLength={3}
            value={values.invoiceCurrency}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, invoiceCurrency: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer-report-country">Country</Label>
          <Input
            id="customer-report-country"
            placeholder="US"
            maxLength={2}
            value={values.countryCode}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, countryCode: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="customer-report-customer">Customer ID</Label>
          <Input
            id="customer-report-customer"
            placeholder="UUID"
            value={values.customerId}
            onChange={(event) => setValues((prev) => ({ ...prev, customerId: event.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer-report-staff">Staff user ID</Label>
          <Input
            id="customer-report-staff"
            placeholder="UUID"
            value={values.staffUserId}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, staffUserId: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer-report-sort-by">Sort by</Label>
          <NativeSelect
            id="customer-report-sort-by"
            value={values.sortBy}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                sortBy: event.target.value as CustomerReportSortField,
              }))
            }
          >
            {CUSTOMER_REPORT_SORT_FIELDS.map((field) => (
              <option key={field} value={field}>
                {SORT_LABELS[field]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer-report-sort-dir">Sort direction</Label>
          <NativeSelect
            id="customer-report-sort-dir"
            value={values.sortDir}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                sortDir: event.target.value as CustomerReportSortDir,
              }))
            }
          >
            {CUSTOMER_REPORT_SORT_DIRS.map((dir) => (
              <option key={dir} value={dir}>
                {dir === "asc" ? "Ascending" : "Descending"}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="customer-report-page-size">Page size</Label>
          <NativeSelect
            id="customer-report-page-size"
            value={values.pageSize || String(CUSTOMER_REPORT_DEFAULT_PAGE_SIZE)}
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
            <Link href="/reports/customers">Clear</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
