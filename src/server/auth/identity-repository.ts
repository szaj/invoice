import "server-only";

import { nowUtc } from "@/lib/time";
import { displayNameFromEmail, type ApplicationUserIdentity } from "@/domain/auth/identity";
import { getPrisma } from "@/server/db/client";

export interface IdentityLinkInput {
  readonly supabaseAuthUserId: string;
  readonly email: string;
}

export interface UserIdentityStore {
  linkAuthenticatedIdentity(input: IdentityLinkInput): Promise<ApplicationUserIdentity>;
}

export class PrismaUserIdentityStore implements UserIdentityStore {
  async linkAuthenticatedIdentity(input: IdentityLinkInput): Promise<ApplicationUserIdentity> {
    const prisma = getPrisma();
    const email = input.email.trim().toLowerCase();
    const lastLoginAt = nowUtc();

    const existing = await prisma.user.findUnique({
      where: { supabaseAuthUserId: input.supabaseAuthUserId },
    });

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          email,
          lastLoginAt,
        },
      });

      return toIdentity(updated);
    }

    const created = await prisma.user.create({
      data: {
        name: displayNameFromEmail(email),
        email,
        supabaseAuthUserId: input.supabaseAuthUserId,
        lastLoginAt,
      },
    });

    return toIdentity(created);
  }
}

function toIdentity(user: {
  id: string;
  name: string;
  email: string;
  supabaseAuthUserId: string;
  lastLoginAt: Date | null;
}): ApplicationUserIdentity {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    supabaseAuthUserId: user.supabaseAuthUserId,
    lastLoginAt: user.lastLoginAt,
  };
}
