"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  createCurrency,
  getCurrency,
  listCurrencies,
  setCurrencyStatus,
  updateCurrency,
} from "@/server/currencies/currency-service";

export type CurrencyActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function createCurrencyAction(input: unknown): Promise<CurrencyActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await createCurrency(actor, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/settings/currencies");
  redirect(`/settings/currencies/${result.data.id}`);
}

export async function updateCurrencyAction(
  currencyId: string,
  input: unknown,
): Promise<CurrencyActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateCurrency(actor, currencyId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/settings/currencies");
  revalidatePath(`/settings/currencies/${currencyId}`);
  revalidatePath(`/settings/currencies/${currencyId}/edit`);
  return { ok: true, message: "Currency updated." };
}

export async function setCurrencyStatusAction(
  currencyId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<CurrencyActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await setCurrencyStatus(actor, currencyId, { status });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/settings/currencies");
  revalidatePath(`/settings/currencies/${currencyId}`);
  revalidatePath(`/settings/currencies/${currencyId}/edit`);
  return {
    ok: true,
    message: status === "ACTIVE" ? "Currency activated." : "Currency disabled.",
  };
}

export async function loadCurrenciesForAdmin() {
  const actor = await getRequestAuthorizationPrincipal();
  return listCurrencies(actor);
}

export async function loadCurrencyForAdmin(currencyId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  return getCurrency(actor, currencyId);
}
