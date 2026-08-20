import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assignedCompanyIdsOf, companyScopeForRole } from "@/domain/authz/company-access";
import {
  ALL_COMPANIES_CONTEXT_VALUE,
  type CompanyContextSelection,
  type ResolvedCompanyContext,
} from "@/domain/company-context/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCompanyContextCookieValue(
  raw: string | null | undefined,
): CompanyContextSelection | null {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed === ALL_COMPANIES_CONTEXT_VALUE) {
    return { kind: "all" };
  }
  if (!UUID_RE.test(trimmed)) {
    return null;
  }
  return { kind: "company", companyId: trimmed };
}

export function serializeCompanyContextSelection(selection: CompanyContextSelection): string {
  return selection.kind === "all" ? ALL_COMPANIES_CONTEXT_VALUE : selection.companyId;
}

/**
 * Pure resolver: cookie/raw selection + principal + accessible company IDs.
 * Does not trust client selection; inaccessible or malformed values are invalid.
 */
export function resolveCompanyContext(input: {
  readonly principal: AuthorizationPrincipal | null;
  readonly rawSelection: string | null | undefined;
  readonly accessibleCompanyIds: readonly string[];
}): ResolvedCompanyContext {
  const { principal, rawSelection, accessibleCompanyIds } = input;

  if (!principal) {
    return { status: "unresolved", reason: "unauthenticated" };
  }
  if (principal.status !== "ACTIVE") {
    return { status: "unresolved", reason: "suspended" };
  }
  if (!principal.roleCode) {
    return { status: "unresolved", reason: "missing_role" };
  }

  const scope = companyScopeForRole(principal.roleCode);
  if (!scope) {
    return { status: "unresolved", reason: "missing_role" };
  }

  const accessible = normalizeAccessibleIds(scope, principal, accessibleCompanyIds);
  const parsed = parseCompanyContextCookieValue(rawSelection);

  if (parsed) {
    if (isSelectionAllowed(scope, parsed, accessible)) {
      return { status: "resolved", selection: parsed };
    }
    return { status: "unresolved", reason: "invalid_selection" };
  }

  const fallback = defaultSelection(scope, accessible);
  if (!fallback) {
    return { status: "unresolved", reason: "no_accessible_companies" };
  }
  return { status: "resolved", selection: fallback };
}

export function isSelectionAllowed(
  scope: "ALL" | "ASSIGNED",
  selection: CompanyContextSelection,
  accessibleCompanyIds: readonly string[],
): boolean {
  if (selection.kind === "all") {
    return scope === "ALL";
  }
  return accessibleCompanyIds.includes(selection.companyId);
}

function normalizeAccessibleIds(
  scope: "ALL" | "ASSIGNED",
  principal: AuthorizationPrincipal,
  accessibleCompanyIds: readonly string[],
): readonly string[] {
  if (scope === "ALL") {
    return accessibleCompanyIds;
  }
  const assigned = new Set(assignedCompanyIdsOf(principal));
  return accessibleCompanyIds.filter((id) => assigned.has(id));
}

function defaultSelection(
  scope: "ALL" | "ASSIGNED",
  accessibleCompanyIds: readonly string[],
): CompanyContextSelection | null {
  if (scope === "ALL") {
    return { kind: "all" };
  }
  const first = accessibleCompanyIds[0];
  if (!first) {
    return null;
  }
  return { kind: "company", companyId: first };
}
