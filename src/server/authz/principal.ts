import "server-only";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { isRoleCode } from "@/domain/authz/roles";
import { getPrisma } from "@/server/db/client";

export async function loadAuthorizationPrincipal(
  supabaseAuthUserId: string,
): Promise<AuthorizationPrincipal | null> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { supabaseAuthUserId },
    select: {
      id: true,
      status: true,
      role: {
        select: { code: true },
      },
      companies: {
        select: { companyId: true },
      },
    },
  });

  if (!user) {
    return null;
  }

  const roleCode = user.role?.code;
  return {
    userId: user.id,
    status: user.status,
    roleCode: isRoleCode(roleCode) ? roleCode : null,
    assignedCompanyIds: user.companies.map((assignment) => assignment.companyId),
  };
}
