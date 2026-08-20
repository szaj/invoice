import "server-only";

import { getAuthenticatedIdentity } from "@/server/auth/session";
import { PrismaUserIdentityStore } from "@/server/auth/identity-repository";
import { hasPasswordRecoverySession } from "@/server/auth/recovery-session";

export async function canSetNewPassword(): Promise<boolean> {
  const identity = await getAuthenticatedIdentity();
  if (!identity) {
    return false;
  }

  if (await hasPasswordRecoverySession()) {
    return true;
  }

  const user = await new PrismaUserIdentityStore().findByAuthUserId(identity.authUserId);
  return user?.passwordResetRequired === true;
}

export async function requiresPasswordReset(authUserId: string): Promise<boolean> {
  const user = await new PrismaUserIdentityStore().findByAuthUserId(authUserId);
  return user?.passwordResetRequired === true;
}
