"use server";

import { revalidatePath } from "next/cache";

import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  getCompanyContextView,
  setCompanyContextSelection,
} from "@/server/company-context/service";

export type SetCompanyContextActionResult = { ok: true } | { ok: false; error: string };

export async function loadCompanyContextForLayout() {
  const principal = await getRequestAuthorizationPrincipal();
  return getCompanyContextView(principal);
}

export async function setCompanyContextAction(
  value: string,
): Promise<SetCompanyContextActionResult> {
  const principal = await getRequestAuthorizationPrincipal();
  const result = await setCompanyContextSelection(principal, value);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Refresh company-scoped surfaces when context changes.
  revalidatePath("/", "layout");
  return { ok: true };
}
