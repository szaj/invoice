"use server";

import { revalidatePath } from "next/cache";

import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  getCompanyCurrencyConfiguration,
  updateCompanyCurrencyConfiguration,
} from "@/server/companies/company-currency-service";

export type CompanyCurrencyActionResult =
  { ok: true; message?: string } | { ok: false; error: string };

export async function loadCompanyCurrenciesForAdmin(companyId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  return getCompanyCurrencyConfiguration(actor, companyId);
}

export async function updateCompanyCurrenciesAction(
  companyId: string,
  input: unknown,
): Promise<CompanyCurrencyActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateCompanyCurrencyConfiguration(actor, companyId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}/currencies`);
  return { ok: true, message: "Company currencies saved." };
}
