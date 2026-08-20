"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  createManagedUser,
  getManagedUser,
  listAssignableCompanies,
  listManagedUsers,
  resetManagedUserPassword,
  suspendManagedUser,
  updateManagedUser,
} from "@/server/users/user-service";

export type UserActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function createUserAction(input: unknown): Promise<UserActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await createManagedUser(actor, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/users");
  redirect(`/users/${result.data.id}`);
}

export async function updateUserAction(userId: string, input: unknown): Promise<UserActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateManagedUser(actor, userId, input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
  return { ok: true, message: "User updated." };
}

export async function suspendUserAction(userId: string): Promise<UserActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await suspendManagedUser(actor, userId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
  return { ok: true, message: "User suspended." };
}

export async function resetUserPasswordAction(userId: string): Promise<UserActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await resetManagedUserPassword(actor, userId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath(`/users/${userId}`);
  return {
    ok: true,
    message: result.data.recoveryRequested
      ? "Password reset required. Recovery email requested."
      : "Password reset required. Recovery email could not be sent; ask the user to use Forgot password.",
  };
}

export async function loadUsersForAdmin() {
  const actor = await getRequestAuthorizationPrincipal();
  return listManagedUsers(actor);
}

export async function loadUserForAdmin(userId: string) {
  const actor = await getRequestAuthorizationPrincipal();
  return getManagedUser(actor, userId);
}

export async function loadAssignableCompaniesForAdmin() {
  const actor = await getRequestAuthorizationPrincipal();
  return listAssignableCompanies(actor);
}
