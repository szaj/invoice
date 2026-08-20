import { AuthorizationError } from "@/domain/authz/errors";
import { assertCompanyAccess } from "@/domain/authz/company-access";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import type { RoleCode } from "@/domain/authz/roles";
import {
  CONCRETE_COMPANY_REQUIRED_MESSAGE,
  COMPANY_CONTEXT_MISMATCH_MESSAGE,
  INVALID_COMPANY_CONTEXT_MESSAGE,
  type CompanyContextSelection,
  type ResolvedCompanyContext,
} from "@/domain/company-context/types";

export class CompanyContextError extends Error {
  readonly status: 400 | 403;

  constructor(message: string, status: 400 | 403 = 400) {
    super(message);
    this.name = "CompanyContextError";
    this.status = status;
  }
}

export function isCompanyContextError(error: unknown): error is CompanyContextError {
  return error instanceof CompanyContextError;
}

export function assertResolvedCompanyContext(
  resolved: ResolvedCompanyContext,
): CompanyContextSelection {
  if (resolved.status !== "resolved") {
    const status = resolved.reason === "invalid_selection" ? 400 : 403;
    throw new CompanyContextError(INVALID_COMPANY_CONTEXT_MESSAGE, status);
  }
  return resolved.selection;
}

/**
 * Transactional / company-scoped writes require one concrete company.
 * Admin "All Companies" is reporting-only (BR from Companies and Brands).
 */
export function requireConcreteCompanyId(resolved: ResolvedCompanyContext): string {
  const selection = assertResolvedCompanyContext(resolved);
  if (selection.kind !== "company") {
    throw new CompanyContextError(CONCRETE_COMPANY_REQUIRED_MESSAGE, 400);
  }
  return selection.companyId;
}

/**
 * Ensures the requested company_id matches the active concrete context and
 * that the principal may access that company (IDOR denial).
 */
export function assertTransactionalCompanyScope(
  principal: AuthorizationPrincipal | null,
  resolved: ResolvedCompanyContext,
  requestedCompanyId: string,
): RoleCode {
  const contextCompanyId = requireConcreteCompanyId(resolved);
  if (contextCompanyId !== requestedCompanyId) {
    throw new CompanyContextError(COMPANY_CONTEXT_MISMATCH_MESSAGE, 403);
  }
  try {
    return assertCompanyAccess(principal, requestedCompanyId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }
    throw error;
  }
}
