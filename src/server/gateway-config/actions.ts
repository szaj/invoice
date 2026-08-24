"use server";

import { revalidatePath } from "next/cache";

import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  getCompanyGatewayConfiguration,
  replaceGatewayMethodCredentials,
  updateGatewayMethodConfiguration,
} from "@/server/gateway-config/gateway-config-service";

export async function loadCompanyGatewaysForAdmin(companyId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  return getCompanyGatewayConfiguration(actor, companyId);
}

export async function updateGatewayMethodConfigAction(
  companyId: string,
  methodCode: string,
  input: unknown,
) {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateGatewayMethodConfiguration(actor, companyId, methodCode, input);
  if (!result.ok) {
    return result;
  }
  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}/gateways`);
  revalidatePath(`/companies/${companyId}/settlement`);
  return result;
}

export async function replaceGatewayCredentialsAction(
  companyId: string,
  methodCode: string,
  input: unknown,
) {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await replaceGatewayMethodCredentials(actor, companyId, methodCode, input);
  if (!result.ok) {
    return result;
  }
  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}/gateways`);
  return result;
}
