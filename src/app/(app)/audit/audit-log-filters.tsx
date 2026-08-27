"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { AUDIT_ACTOR_TYPES, AuditEntityTypes, type AuditActorType } from "@/domain/audit/types";

type CompanyOption = { id: string; displayName: string };

const ENTITY_TYPE_OPTIONS = Object.values(AuditEntityTypes);

export type AuditLogFilterValues = {
  companyId: string;
  actorUserId: string;
  actorType: AuditActorType | "";
  entityType: string;
  entityId: string;
  action: string;
  dateFrom: string;
  dateTo: string;
};

export function AuditLogFilters({
  initial,
  companies,
}: {
  initial: AuditLogFilterValues;
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
    if (values.actorUserId.trim()) {
      params.set("actorUserId", values.actorUserId.trim());
    }
    if (values.actorType) {
      params.set("actorType", values.actorType);
    }
    if (values.entityType) {
      params.set("entityType", values.entityType);
    }
    if (values.entityId.trim()) {
      params.set("entityId", values.entityId.trim());
    }
    if (values.action.trim()) {
      params.set("action", values.action.trim());
    }
    if (values.dateFrom) {
      params.set("dateFrom", values.dateFrom);
    }
    if (values.dateTo) {
      params.set("dateTo", values.dateTo);
    }
    const query = params.toString();
    router.push(query ? `/audit?${query}` : "/audit");
  }

  const hasFilters = Object.values(initial).some((value) => Boolean(value));

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="audit-filter-company">Company</Label>
        <NativeSelect
          id="audit-filter-company"
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
        <Label htmlFor="audit-filter-actor-type">Actor type</Label>
        <NativeSelect
          id="audit-filter-actor-type"
          value={values.actorType}
          onChange={(event) =>
            setValues((prev) => ({
              ...prev,
              actorType: event.target.value as AuditActorType | "",
            }))
          }
        >
          <option value="">All</option>
          {AUDIT_ACTOR_TYPES.map((type) => (
            <option key={type} value={type}>
              {type === "USER" ? "User" : type === "SYSTEM" ? "System" : "Webhook"}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="audit-filter-entity-type">Entity type</Label>
        <NativeSelect
          id="audit-filter-entity-type"
          className="max-w-[16rem]"
          value={values.entityType}
          onChange={(event) => setValues((prev) => ({ ...prev, entityType: event.target.value }))}
        >
          <option value="">All</option>
          {ENTITY_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="audit-filter-action">Action</Label>
        <Input
          id="audit-filter-action"
          className="w-56 font-mono text-xs"
          placeholder="payments.created"
          value={values.action}
          onChange={(event) => setValues((prev) => ({ ...prev, action: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="audit-filter-entity-id">Entity ID</Label>
        <Input
          id="audit-filter-entity-id"
          className="w-64 font-mono text-xs"
          placeholder="ID"
          value={values.entityId}
          onChange={(event) => setValues((prev) => ({ ...prev, entityId: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="audit-filter-actor">Actor user ID</Label>
        <Input
          id="audit-filter-actor"
          className="w-64 font-mono text-xs"
          placeholder="UUID"
          value={values.actorUserId}
          onChange={(event) => setValues((prev) => ({ ...prev, actorUserId: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="audit-filter-date-from">Date from</Label>
        <Input
          id="audit-filter-date-from"
          type="date"
          value={values.dateFrom}
          onChange={(event) => setValues((prev) => ({ ...prev, dateFrom: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="audit-filter-date-to">Date to</Label>
        <Input
          id="audit-filter-date-to"
          type="date"
          value={values.dateTo}
          onChange={(event) => setValues((prev) => ({ ...prev, dateTo: event.target.value }))}
        />
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
      {hasFilters ? (
        <Button asChild variant="ghost">
          <Link href="/audit">Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}
