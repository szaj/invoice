"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CompanyOption = { id: string; displayName: string };

export function CustomerListFilters({
  initialQ,
  initialStatus,
  initialCompanyId,
  companies,
}: {
  initialQ: string;
  initialStatus: string;
  initialCompanyId: string;
  companies: readonly CompanyOption[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [companyId, setCompanyId] = useState(initialCompanyId);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) {
      params.set("q", q.trim());
    }
    if (status) {
      params.set("status", status);
    }
    if (companyId) {
      params.set("companyId", companyId);
    }
    const query = params.toString();
    router.push(query ? `/customers?${query}` : "/customers");
  }

  const hasFilters = Boolean(initialQ || initialStatus || initialCompanyId);

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
      <div className="grid min-w-[12rem] flex-1 gap-2">
        <Label htmlFor="customer-search-q">Search</Label>
        <Input
          id="customer-search-q"
          name="q"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Name, email, phone…"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="customer-search-status">Status</Label>
        <select
          id="customer-search-status"
          name="status"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="customer-search-company">Company</Label>
        <select
          id="customer-search-company"
          name="companyId"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 max-w-[14rem] rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
        >
          <option value="">All authorized</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
      {hasFilters ? (
        <Button asChild variant="ghost">
          <Link href="/customers">Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}
