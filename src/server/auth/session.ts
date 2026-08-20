import "server-only";

import { identityFromAuthUser, type AuthenticatedIdentity } from "@/domain/auth/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

/**
 * Server-side identity only.
 * A non-null result means a valid authenticated session exists.
 * It does not mean the identity is authorized for any company or privileged action.
 */
export async function getAuthenticatedIdentity(): Promise<AuthenticatedIdentity | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return identityFromAuthUser(data.user);
  } catch {
    return null;
  }
}

export async function requireAuthenticatedIdentity(): Promise<AuthenticatedIdentity> {
  const identity = await getAuthenticatedIdentity();

  if (!identity) {
    throw new Error("UNAUTHENTICATED");
  }

  return identity;
}
