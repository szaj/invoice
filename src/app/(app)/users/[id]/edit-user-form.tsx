"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_CODES, type RoleCode } from "@/domain/authz/roles";
import type { ManagedUser } from "@/domain/users/types";
import {
  updateUserSchema,
  type UpdateUserFormValues,
  type UpdateUserInput,
} from "@/domain/users/user-schema";
import {
  resetUserPasswordAction,
  suspendUserAction,
  updateUserAction,
} from "@/server/users/actions";
import {
  CompanyAssignmentFields,
  type AssignableCompanyOption,
} from "@/app/(app)/users/company-assignment-fields";

export function EditUserForm({
  user,
  canSuspend,
  companies,
}: {
  user: Omit<ManagedUser, "lastLoginAt" | "createdAt" | "updatedAt"> & {
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  canSuspend: boolean;
  companies: readonly AssignableCompanyOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<UpdateUserFormValues, unknown, UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      roleCode: (user.roleCode ?? "STAFF") as RoleCode,
      employeeId: user.employeeId ?? "",
      mfaEnabled: user.mfaEnabled,
      status: user.status,
      passwordResetRequired: user.passwordResetRequired,
      companyIds: [...user.companyIds],
    },
  });

  async function onSubmit(values: UpdateUserInput) {
    setError(null);
    setMessage(null);
    const result = await updateUserAction(user.id, values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Saved.");
  }

  async function onSuspend() {
    setError(null);
    setMessage(null);
    const result = await suspendUserAction(user.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Suspended.");
    form.setValue("status", "SUSPENDED");
  }

  async function onResetPassword() {
    setError(null);
    setMessage(null);
    const result = await resetUserPasswordAction(user.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Password reset required.");
    form.setValue("passwordResetRequired", true);
  }

  return (
    <div className="grid gap-6">
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" {...form.register("name")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...form.register("email")} />
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
        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            {...form.register("status")}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("mfaEnabled")} />
          MFA enabled (status only)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("passwordResetRequired")} />
          Password reset required (workflow flag, not a permission)
        </label>
        <CompanyAssignmentFields
          companies={companies}
          register={(name) => form.register(name) as Record<string, unknown>}
        />
        <p className="text-muted-foreground text-xs">Last login: {user.lastLoginAt ?? "Never"}</p>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save changes"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/users">Back to list</Link>
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-3 border-t pt-4">
        {canSuspend && user.status !== "SUSPENDED" ? (
          <Button type="button" variant="destructive" onClick={onSuspend}>
            Suspend user
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={onResetPassword}>
          Require password reset
        </Button>
      </div>
    </div>
  );
}
