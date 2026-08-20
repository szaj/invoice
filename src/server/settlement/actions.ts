"use server";

import { revalidatePath } from "next/cache";

import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  getCompanySettlementConfiguration,
  updatePaymentMethodSettlementConfiguration,
} from "@/server/settlement/settlement-service";

export async function loadCompanySettlementForAdmin(companyId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  return getCompanySettlementConfiguration(actor, companyId);
}

export async function updatePaymentMethodSettlementAction(
  companyId: string,
  methodCode: string,
  input: unknown,
) {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updatePaymentMethodSettlementConfiguration(
    actor,
    companyId,
    methodCode,
    input,
  );
  if (!result.ok) {
    return result;
  }
  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}/settlement`);
  return result;
}
