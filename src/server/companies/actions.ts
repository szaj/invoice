"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizePermission } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  createCompany,
  getCompany,
  listCompanies,
  setCompanyStatus,
  updateCompany,
} from "@/server/companies/company-service";

export type CompanyActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function createCompanyAction(input: unknown): Promise<CompanyActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await createCompany(actor, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/companies");
  redirect(`/companies/${result.data.id}`);
}

export async function updateCompanyAction(
  companyId: string,
  input: unknown,
): Promise<CompanyActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateCompany(actor, companyId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}/edit`);
  return { ok: true, message: "Company updated." };
}

export async function setCompanyStatusAction(
  companyId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<CompanyActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await setCompanyStatus(actor, companyId, { status });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}/edit`);
  return {
    ok: true,
    message: status === "ACTIVE" ? "Company activated." : "Company deactivated.",
  };
}

export async function loadCompaniesForAdmin() {
  const actor = await getRequestAuthorizationPrincipal();
  return listCompanies(actor);
}

export async function loadCompanyForAdmin(companyId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "company.write").allowed) {
    return { ok: false as const, status: 403 as const, error: GENERIC_FORBIDDEN };
  }
  return getCompany(actor, companyId);
}
