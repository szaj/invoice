"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { listCurrencies } from "@/server/currencies/currency-service";
import {
  createFixedConversionRate,
  listFixedConversionRates,
} from "@/server/fixed-rates/fixed-rate-service";

export async function createFixedConversionRateAction(input: unknown) {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await createFixedConversionRate(actor, input);
  if (!result.ok) {
    return result;
  }

  revalidatePath("/settings/fixed-rates");
  revalidatePath("/settings/fixed-rates/new");
  redirect(`/settings/fixed-rates?created=${result.data.id}`);
}

export async function loadCurrenciesForFixedRateForm() {
  const actor = await getRequestAuthorizationPrincipal();
  return listCurrencies(actor);
}

export async function loadFixedConversionRatesForAdmin(filter?: {
  fromCurrency?: string;
  toCurrency?: string;
}) {
  const actor = await getRequestAuthorizationPrincipal();
  return listFixedConversionRates(actor, filter ?? {});
}
