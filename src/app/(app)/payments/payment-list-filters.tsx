"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/domain/payments/types";

type CompanyOption = { id: string; displayName: string };

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  SUCCESSFUL: "Successful",
  FAILED: "Failed",
};

export function PaymentListFilters({
  initialCompanyId,
  initialStatus,
  companies,
}: {
  initialCompanyId: string;
  initialStatus: PaymentStatus | "";
  companies: readonly CompanyOption[];
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [status, setStatus] = useState<PaymentStatus | "">(initialStatus);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (companyId) {
      params.set("companyId", companyId);
    }
    if (status) {
      params.set("status", status);
    }
    const query = params.toString();
    router.push(query ? `/payments?${query}` : "/payments");
  }

  const hasFilters = Boolean(initialCompanyId || initialStatus);

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="payment-filter-company">Company</Label>
        <select
          id="payment-filter-company"
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
        <Label htmlFor="payment-filter-status">Status</Label>
        <select
          id="payment-filter-status"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          value={status}
          onChange={(event) => setStatus(event.target.value as PaymentStatus | "")}
        >
          <option value="">All</option>
          {PAYMENT_STATUSES.map((value) => (
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
          <Link href="/payments">Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}
