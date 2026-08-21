"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/domain/invoices/types";

type CompanyOption = { id: string; displayName: string };

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export function InvoiceListFilters({
  initialCompanyId,
  initialStatus,
  companies,
}: {
  initialCompanyId: string;
  initialStatus: InvoiceStatus;
  companies: readonly CompanyOption[];
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [status, setStatus] = useState<InvoiceStatus>(initialStatus);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (companyId) {
      params.set("companyId", companyId);
    }
    params.set("status", status);
    const query = params.toString();
    router.push(query ? `/invoices?${query}` : "/invoices");
  }

  const hasFilters = Boolean(initialCompanyId) || initialStatus !== "DRAFT";

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="invoice-filter-company">Company</Label>
        <select
          id="invoice-filter-company"
          name="companyId"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 max-w-[16rem] rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
        >
          <option value="">
            {companies.length === 1 ? (companies[0]?.displayName ?? "Company") : "Select company"}
          </option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          List is company-scoped. Admin must choose a company (or use the header switcher).
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invoice-filter-status">Status</Label>
        <select
          id="invoice-filter-status"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          value={status}
          onChange={(event) => setStatus(event.target.value as InvoiceStatus)}
        >
          {INVOICE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
      {hasFilters ? (
        <Button asChild variant="ghost">
          <Link href="/invoices">Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}
