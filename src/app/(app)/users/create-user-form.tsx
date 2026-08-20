"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_CODES } from "@/domain/authz/roles";
import {
  createUserSchema,
  type CreateUserFormValues,
  type CreateUserInput,
} from "@/domain/users/user-schema";
import { createUserAction } from "@/server/users/actions";
import {
  CompanyAssignmentFields,
  type AssignableCompanyOption,
} from "@/app/(app)/users/company-assignment-fields";

export function CreateUserForm({ companies }: { companies: readonly AssignableCompanyOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CreateUserFormValues, unknown, CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      roleCode: "STAFF",
      employeeId: "",
      mfaEnabled: false,
      passwordResetRequired: true,
      status: "ACTIVE",
      companyIds: [],
    },
  });

  async function onSubmit(values: CreateUserInput) {
    setError(null);
    const result = await createUserAction(values);
    if (result && !result.ok) {
      setError(result.error);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="grid gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-destructive text-sm">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="off" {...form.register("email")} />
        {form.formState.errors.email ? (
          <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="roleCode">Role</Label>
        <select
          id="roleCode"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          {...form.register("roleCode")}
        >
          {ROLE_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="employeeId">Employee ID (optional)</Label>
        <Input id="employeeId" {...form.register("employeeId")} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register("mfaEnabled")} />
        MFA enabled (status only; challenge not required)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register("passwordResetRequired")} />
        Password reset required (workflow flag)
      </label>
      <CompanyAssignmentFields
        companies={companies}
        register={(name) => form.register(name) as Record<string, unknown>}
      />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating…" : "Create user"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/users">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
