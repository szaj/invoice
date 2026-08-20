"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizePermission } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  createReportingGroup,
  getReportingGroup,
  listReportingGroups,
  setReportingGroupStatus,
  updateReportingGroup,
} from "@/server/reporting-groups/reporting-group-service";
import { listCompanies } from "@/server/companies/company-service";

export type ReportingGroupActionResult =
  { ok: true; message?: string } | { ok: false; error: string };

function revalidateReportingGroupPaths(groupId?: string) {
  revalidatePath("/settings/reporting-groups");
  if (groupId) {
    revalidatePath(`/settings/reporting-groups/${groupId}`);
    revalidatePath(`/settings/reporting-groups/${groupId}/edit`);
  }
}

export async function loadReportingGroupsForAdmin() {
  const actor = await getRequestAuthorizationPrincipal();
  return listReportingGroups(actor);
}

export async function loadReportingGroupForAdmin(groupId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "company.write").allowed) {
    return { ok: false as const, status: 403 as const, error: GENERIC_FORBIDDEN };
  }
  return getReportingGroup(actor, groupId);
}

export async function loadCompaniesForReportingGroupForm() {
  const actor = await getRequestAuthorizationPrincipal();
  return listCompanies(actor);
}

export async function createReportingGroupAction(
  input: unknown,
): Promise<ReportingGroupActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await createReportingGroup(actor, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidateReportingGroupPaths(result.data.id);
  redirect(`/settings/reporting-groups/${result.data.id}`);
}

export async function updateReportingGroupAction(
  groupId: string,
  input: unknown,
): Promise<ReportingGroupActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateReportingGroup(actor, groupId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidateReportingGroupPaths(groupId);
  return { ok: true, message: "Reporting group updated." };
}

export async function setReportingGroupStatusAction(
  groupId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<ReportingGroupActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await setReportingGroupStatus(actor, groupId, { status });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidateReportingGroupPaths(groupId);
  return {
    ok: true,
    message: status === "ACTIVE" ? "Reporting group activated." : "Reporting group deactivated.",
  };
}
