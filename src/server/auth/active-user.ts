import "server-only";

import { getAuthenticatedIdentity } from "@/server/auth/session";
import { PrismaUserIdentityStore } from "@/server/auth/identity-repository";
import { logoutCurrentSession } from "@/server/auth/logout";

export async function enforceActiveApplicationUser(): Promise<
  "ok" | "unauthenticated" | "suspended"
> {
  const identity = await getAuthenticatedIdentity();
  if (!identity) {
    return "unauthenticated";
  }

  const status = await new PrismaUserIdentityStore().getStatusByAuthUserId(identity.authUserId);
  if (status === "SUSPENDED") {
    await logoutCurrentSession();
    return "suspended";
  }

  return "ok";
}
