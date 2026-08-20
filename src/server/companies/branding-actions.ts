"use server";

import { revalidatePath } from "next/cache";

import { authorizePermission } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  getCompanyBranding,
  removeCompanyLogo,
  updateCompanyBranding,
  uploadCompanyLogo,
} from "@/server/companies/branding-service";

export type CompanyBrandingActionResult =
  { ok: true; message?: string } | { ok: false; error: string };

function revalidateBrandingPaths(companyId: string) {
  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}/branding`);
  revalidatePath(`/companies/${companyId}/edit`);
}

export async function loadCompanyBrandingForAdmin(companyId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "company.write").allowed) {
    return { ok: false as const, status: 403 as const, error: GENERIC_FORBIDDEN };
  }
  return getCompanyBranding(actor, companyId);
}

export async function updateCompanyBrandingAction(
  companyId: string,
  input: unknown,
): Promise<CompanyBrandingActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateCompanyBranding(actor, companyId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidateBrandingPaths(companyId);
  return { ok: true, message: "Invoice branding saved." };
}

export async function uploadCompanyLogoAction(
  companyId: string,
  formData: FormData,
): Promise<CompanyBrandingActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const file = formData.get("logo");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a logo image to upload." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadCompanyLogo(actor, companyId, {
    bytes,
    declaredMimeType: file.type,
    originalFilename: file.name,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidateBrandingPaths(companyId);
  return { ok: true, message: "Logo uploaded." };
}

export async function removeCompanyLogoAction(
  companyId: string,
): Promise<CompanyBrandingActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await removeCompanyLogo(actor, companyId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidateBrandingPaths(companyId);
  return { ok: true, message: "Logo removed." };
}
