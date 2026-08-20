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
  findByAuthUserId(supabaseAuthUserId: string): Promise<ApplicationUserIdentity | null>;
  clearPasswordResetRequired(supabaseAuthUserId: string): Promise<void>;
  getStatusByAuthUserId(supabaseAuthUserId: string): Promise<"ACTIVE" | "SUSPENDED" | null>;
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

  async findByAuthUserId(supabaseAuthUserId: string): Promise<ApplicationUserIdentity | null> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { supabaseAuthUserId },
    });

    return user ? toIdentity(user) : null;
  }

  async clearPasswordResetRequired(supabaseAuthUserId: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.user.updateMany({
      where: { supabaseAuthUserId, passwordResetRequired: true },
      data: { passwordResetRequired: false },
    });
  }

  async getStatusByAuthUserId(supabaseAuthUserId: string): Promise<"ACTIVE" | "SUSPENDED" | null> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { supabaseAuthUserId },
      select: { status: true },
    });
    return user?.status ?? null;
  }
}

function toIdentity(user: {
  id: string;
  name: string;
  email: string;
  supabaseAuthUserId: string;
  lastLoginAt: Date | null;
  passwordResetRequired: boolean;
}): ApplicationUserIdentity {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    supabaseAuthUserId: user.supabaseAuthUserId,
    lastLoginAt: user.lastLoginAt,
    passwordResetRequired: user.passwordResetRequired,
  };
}
