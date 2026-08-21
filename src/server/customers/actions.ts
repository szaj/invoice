"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizePermission } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { listSwitcherCompanies } from "@/server/company-context/accessible-companies";
import { loadCompanyContextForLayout } from "@/server/company-context/actions";
import { getCustomerProfile } from "@/server/customers/customer-profile-service";
import { createCustomerNote } from "@/server/customers/customer-note-service";
import {
  createCustomer,
  getCustomer,
  listCustomers,
  setCustomerStatus,
  updateCustomer,
} from "@/server/customers/customer-service";

export type CustomerActionResult =
  | { ok: true; message?: string }
  | {
      ok: false;
      error: string;
      code?: string;
      duplicates?: Array<{
        customerId: string;
        displayName: string;
        email: string | null;
        phone: string | null;
        status: "ACTIVE" | "INACTIVE";
        matchedFields: readonly ("email" | "phone" | "displayName")[];
      }>;
      canAcknowledgeDuplicates?: boolean;
    };

export async function createCustomerAction(input: unknown): Promise<CustomerActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await createCustomer(actor, input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      ...(result.code ? { code: result.code } : {}),
      ...(result.duplicates ? { duplicates: [...result.duplicates] } : {}),
      canAcknowledgeDuplicates: actor?.roleCode === "ADMIN" || actor?.roleCode === "COMPLIANCE",
    };
  }
  revalidatePath("/customers");
  redirect(`/customers/${result.data.id}`);
}

export async function updateCustomerAction(
  customerId: string,
  input: unknown,
): Promise<CustomerActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateCustomer(actor, customerId, input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      ...(result.code ? { code: result.code } : {}),
      ...(result.duplicates ? { duplicates: [...result.duplicates] } : {}),
      canAcknowledgeDuplicates: actor?.roleCode === "ADMIN" || actor?.roleCode === "COMPLIANCE",
    };
  }
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}/edit`);
  return { ok: true, message: "Customer updated." };
}

export async function setCustomerStatusAction(
  customerId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<CustomerActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await setCustomerStatus(actor, customerId, { status });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}/edit`);
  return {
    ok: true,
    message: status === "ACTIVE" ? "Customer activated." : "Customer deactivated.",
  };
}

export async function loadCustomersForUi(
  query: { q?: string; status?: string; companyId?: string } = {},
) {
  const actor = await getRequestAuthorizationPrincipal();
  return listCustomers(actor, query);
}

export async function loadCustomerForUi(customerId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  return getCustomer(actor, customerId);
}

export async function loadCustomerProfileForUi(
  customerId: string,
  query: { companyId?: string } = {},
) {
  const actor = await getRequestAuthorizationPrincipal();
  return getCustomerProfile(actor, customerId, query);
}

export async function createCustomerNoteAction(
  customerId: string,
  input: unknown,
): Promise<CustomerActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await createCustomerNote(actor, customerId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, message: "Note added." };
}

export async function loadCustomerFormOptions() {
  const actor = await getRequestAuthorizationPrincipal();
  if (
    !authorizePermission(actor, "customer.create").allowed &&
    !authorizePermission(actor, "customer.edit").allowed
  ) {
    return {
      ok: false as const,
      status: 403 as const,
      error: GENERIC_FORBIDDEN,
      companies: [] as Array<{ id: string; displayName: string }>,
      defaultCompanyId: null as string | null,
      canDelete: false,
    };
  }

  const companies = await listSwitcherCompanies(actor);
  const context = await loadCompanyContextForLayout();
  const defaultCompanyId =
    context.selection?.kind === "company" ? context.selection.companyId : null;

  return {
    ok: true as const,
    companies: companies.map((company) => ({
      id: company.id,
      displayName: company.displayName,
    })),
    defaultCompanyId,
    canDelete: authorizePermission(actor, "customer.delete").allowed,
    canCreate: authorizePermission(actor, "customer.create").allowed,
  };
}
