/**
 * Authenticated identity from Supabase Auth.
 *
 * This is not authorization. Application roles and permissions live in the
 * application database (TASK-005) and are never read from Auth metadata.
 */
export interface AuthenticatedIdentity {
  readonly authUserId: string;
  readonly email: string;
}

export interface ApplicationUserIdentity {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly supabaseAuthUserId: string;
  readonly lastLoginAt: Date | null;
  readonly passwordResetRequired: boolean;
}

export function identityFromAuthUser(
  user: { id?: string | null; email?: string | null } | null | undefined,
): AuthenticatedIdentity | null {
  if (!user?.id || !user.email) {
    return null;
  }

  return {
    authUserId: user.id,
    email: user.email,
  };
}

export function displayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0]?.trim();
  return localPart && localPart.length > 0 ? localPart : email;
}
