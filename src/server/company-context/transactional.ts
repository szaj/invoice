import "server-only";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { isAuthorizationError } from "@/domain/authz/errors";
import {
  assertTransactionalCompanyScope,
  isCompanyContextError,
} from "@/domain/company-context/enforce";
import { companyIdSchema } from "@/domain/companies/company-schema";
import { getResolvedCompanyContext } from "@/server/company-context/service";

export type TransactionalCompanyScopeResult =
  { ok: true; companyId: string } | { ok: false; status: 400 | 401 | 403; error: string };

/**
 * Representative company-scoped transactional gate for TASK-009.
 * Later modules (customers, invoices, payments) must call the same domain enforcement.
 * Rejects All Companies context and cross-company IDOR.
 */
export async function assertTransactionalCompanyRequest(
  principal: AuthorizationPrincipal | null,
  requestedCompanyId: string,
): Promise<TransactionalCompanyScopeResult> {
  const parsedId = companyIdSchema.safeParse(requestedCompanyId);
  if (!parsedId.success) {
    return { ok: false, status: 400, error: "Invalid company context." };
  }

  try {
    const resolved = await getResolvedCompanyContext(principal);
    assertTransactionalCompanyScope(principal, resolved, parsedId.data);
    return { ok: true, companyId: parsedId.data };
  } catch (error) {
    if (isCompanyContextError(error)) {
      return { ok: false, status: error.status, error: error.message };
    }
    if (isAuthorizationError(error)) {
      return { ok: false, status: error.status, error: error.message };
    }
    throw error;
  }
}
