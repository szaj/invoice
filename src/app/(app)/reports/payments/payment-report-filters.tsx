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
  PAYMENT_REPORT_DEFAULT_PAGE_SIZE,
  PAYMENT_REPORT_SORT_DIRS,
  PAYMENT_REPORT_SORT_FIELDS,
  type PaymentReportSortDir,
  type PaymentReportSortField,
} from "@/domain/reporting/types";
import { PAYMENT_METHOD_CODES, type PaymentMethodCode } from "@/domain/settlement/types";

type CompanyOption = { id: string; displayName: string };
type ReportingGroupOption = { id: string; name: string };

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  SUCCESSFUL: "Successful",
  FAILED: "Failed",
};

const METHOD_LABELS: Record<PaymentMethodCode, string> = {
  MANUAL: "Manual",
  STRIPE: "Stripe",
  PAYPAL: "PayPal",
  BANK_PROCESSOR: "Bank processor",
};

const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  FLAGGED: "Flagged",
};

const SORT_LABELS: Record<PaymentReportSortField, string> = {
  invoice: "Invoice",
  customer: "Customer",
  method: "Method",
  transactionId: "Transaction ID",
  applied: "Invoice amount applied",
  rate: "Fixed rate",
  settlement: "Converted settlement",
  fee: "Processor fee",
  actualReceived: "Actual received",
  currency: "Settlement currency",
  date: "Payment date",
  status: "Status",
};

export type PaymentReportFilterValues = {
  companyId: string;
  customerId: string;
  staffUserId: string;
  reportingGroupId: string;
  dateFrom: string;
  dateTo: string;
  paymentStatus: PaymentStatus | "";
  paymentMethod: PaymentMethodCode | "";
  invoiceCurrency: string;
  settlementCurrency: string;
  countryCode: string;
  complianceStatus: ComplianceStatus | "";
  pageSize: string;
  sortBy: PaymentReportSortField;
  sortDir: PaymentReportSortDir;
};

export function PaymentReportFilters({
  initial,
  companies,
  reportingGroups,
  allowsAllCompanies,
}: {
  initial: PaymentReportFilterValues;
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
    if (values.pageSize && values.pageSize !== String(PAYMENT_REPORT_DEFAULT_PAGE_SIZE)) {
      params.set("pageSize", values.pageSize);
    }
    if (values.sortBy !== "date") {
      params.set("sortBy", values.sortBy);
    }
    if (values.sortDir !== "desc") {
      params.set("sortDir", values.sortDir);
    }
    const query = params.toString();
    router.push(query ? `/reports/payments?${query}` : "/reports/payments");
  }

  const hasFilters =
    Boolean(initial.companyId) ||
    Boolean(initial.customerId) ||
    Boolean(initial.staffUserId) ||
    Boolean(initial.reportingGroupId) ||
    Boolean(initial.dateFrom) ||
    Boolean(initial.dateTo) ||
    Boolean(initial.paymentStatus) ||
    Boolean(initial.paymentMethod) ||
    Boolean(initial.invoiceCurrency) ||
    Boolean(initial.settlementCurrency) ||
    Boolean(initial.countryCode) ||
    Boolean(initial.complianceStatus) ||
    initial.sortBy !== "date" ||
    initial.sortDir !== "desc" ||
    (initial.pageSize !== "" && initial.pageSize !== String(PAYMENT_REPORT_DEFAULT_PAGE_SIZE));

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="payment-report-company">Company</Label>
          <NativeSelect
            id="payment-report-company"
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
          <Label htmlFor="payment-report-group">Reporting group</Label>
          <NativeSelect
            id="payment-report-group"
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
          <Label htmlFor="payment-report-status">Payment status</Label>
          <NativeSelect
            id="payment-report-status"
            value={values.paymentStatus}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                paymentStatus: event.target.value as PaymentStatus | "",
              }))
            }
          >
            <option value="">Any status</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PAYMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-report-method">Method</Label>
          <NativeSelect
            id="payment-report-method"
            value={values.paymentMethod}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                paymentMethod: event.target.value as PaymentMethodCode | "",
              }))
            }
          >
            <option value="">Any method</option>
            {PAYMENT_METHOD_CODES.map((method) => (
              <option key={method} value={method}>
                {METHOD_LABELS[method]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-report-compliance">Compliance</Label>
          <NativeSelect
            id="payment-report-compliance"
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
          <Label htmlFor="payment-report-date-from">Payment date from</Label>
          <Input
            id="payment-report-date-from"
            type="date"
            value={values.dateFrom}
            onChange={(event) => setValues((prev) => ({ ...prev, dateFrom: event.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-report-date-to">Payment date to</Label>
          <Input
            id="payment-report-date-to"
            type="date"
            value={values.dateTo}
            onChange={(event) => setValues((prev) => ({ ...prev, dateTo: event.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-report-invoice-currency">Invoice currency</Label>
          <Input
            id="payment-report-invoice-currency"
            placeholder="USD"
            maxLength={3}
            value={values.invoiceCurrency}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, invoiceCurrency: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-report-settlement-currency">Settlement currency</Label>
          <Input
            id="payment-report-settlement-currency"
            placeholder="AED"
            maxLength={3}
            value={values.settlementCurrency}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, settlementCurrency: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-report-country">Country</Label>
          <Input
            id="payment-report-country"
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
          <Label htmlFor="payment-report-customer">Customer ID</Label>
          <Input
            id="payment-report-customer"
            placeholder="UUID"
            value={values.customerId}
            onChange={(event) => setValues((prev) => ({ ...prev, customerId: event.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-report-staff">Staff user ID</Label>
          <Input
            id="payment-report-staff"
            placeholder="UUID"
            value={values.staffUserId}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, staffUserId: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-report-sort-by">Sort by</Label>
          <NativeSelect
            id="payment-report-sort-by"
            value={values.sortBy}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                sortBy: event.target.value as PaymentReportSortField,
              }))
            }
          >
            {PAYMENT_REPORT_SORT_FIELDS.map((field) => (
              <option key={field} value={field}>
                {SORT_LABELS[field]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-report-sort-dir">Sort direction</Label>
          <NativeSelect
            id="payment-report-sort-dir"
            value={values.sortDir}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                sortDir: event.target.value as PaymentReportSortDir,
              }))
            }
          >
            {PAYMENT_REPORT_SORT_DIRS.map((dir) => (
              <option key={dir} value={dir}>
                {dir === "asc" ? "Ascending" : "Descending"}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="payment-report-page-size">Page size</Label>
          <NativeSelect
            id="payment-report-page-size"
            value={values.pageSize || String(PAYMENT_REPORT_DEFAULT_PAGE_SIZE)}
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
            <Link href="/reports/payments">Clear</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
