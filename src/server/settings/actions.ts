"use server";

import { revalidatePath } from "next/cache";

import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/server/settings/notification-settings-service";
import { getSystemSettings, updateSystemSettings } from "@/server/settings/settings-service";

export type SystemSettingsActionResult =
  { ok: true; message?: string } | { ok: false; status: number; error: string };

export async function loadSystemSettingsForAdmin() {
  const actor = await getRequestAuthorizationPrincipal();
  return getSystemSettings(actor);
}

export async function updateSystemSettingsAction(
  input: unknown,
): Promise<SystemSettingsActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateSystemSettings(actor, input);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  revalidatePath("/settings/system");
  revalidatePath("/");
  return { ok: true, message: "System settings saved." };
}

export async function loadNotificationSettingsForAdmin() {
  const actor = await getRequestAuthorizationPrincipal();
  return getNotificationSettings(actor);
}

export async function updateNotificationSettingsAction(
  input: unknown,
): Promise<SystemSettingsActionResult> {
  const actor = await getRequestAuthorizationPrincipal();
  const result = await updateNotificationSettings(actor, input);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  revalidatePath("/settings/notifications");
  revalidatePath("/");
  return { ok: true, message: "Notification settings saved." };
}
