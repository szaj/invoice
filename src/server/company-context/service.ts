import "server-only";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  isSelectionAllowed,
  resolveCompanyContext,
  serializeCompanyContextSelection,
} from "@/domain/company-context/resolve";
import type {
  CompanyContextSelection,
  ResolvedCompanyContext,
} from "@/domain/company-context/types";
import {
  ALL_COMPANIES_CONTEXT_VALUE,
  INVALID_COMPANY_CONTEXT_MESSAGE,
} from "@/domain/company-context/types";
import { companyScopeForRole } from "@/domain/authz/company-access";
import {
  createDefaultCompanyContextStore,
  listSwitcherCompanies,
  type CompanyContextStore,
} from "@/server/company-context/accessible-companies";
import {
  clearCompanyContextCookie,
  readCompanyContextCookie,
  writeCompanyContextCookie,
} from "@/server/company-context/session";

export type CompanyContextServiceResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403; error: string };

export interface CompanyContextView {
  readonly resolved: ResolvedCompanyContext;
  readonly selection: CompanyContextSelection | null;
  readonly companies: Array<{ id: string; displayName: string; status: string }>;
  readonly allowsAllCompanies: boolean;
}

export async function getCompanyContextView(
  principal: AuthorizationPrincipal | null,
  store: CompanyContextStore = createDefaultCompanyContextStore(),
): Promise<CompanyContextView> {
  const companies = await listSwitcherCompanies(principal, store);
  const accessibleCompanyIds = companies.map((company) => company.id);
  const raw = await readCompanyContextCookie();
  let resolved = resolveCompanyContext({
    principal,
    rawSelection: raw,
    accessibleCompanyIds,
  });

  // Invalid stored selection is cleared; transactional paths still reject All Companies / IDOR.
  if (resolved.status === "unresolved" && resolved.reason === "invalid_selection") {
    await clearCompanyContextCookie();
    resolved = resolveCompanyContext({
      principal,
      rawSelection: null,
      accessibleCompanyIds,
    });
  }

  const scope = principal?.roleCode ? companyScopeForRole(principal.roleCode) : null;

  return {
    resolved,
    selection: resolved.status === "resolved" ? resolved.selection : null,
    companies: companies.map((company) => ({
      id: company.id,
      displayName: company.displayName,
      status: company.status,
    })),
    allowsAllCompanies: scope === "ALL",
  };
}

export async function setCompanyContextSelection(
  principal: AuthorizationPrincipal | null,
  rawValue: string,
  store: CompanyContextStore = createDefaultCompanyContextStore(),
): Promise<CompanyContextServiceResult<CompanyContextSelection>> {
  if (!principal?.roleCode || principal.status !== "ACTIVE") {
    return { ok: false, status: 403, error: INVALID_COMPANY_CONTEXT_MESSAGE };
  }

  const scope = companyScopeForRole(principal.roleCode);
  if (!scope) {
    return { ok: false, status: 403, error: INVALID_COMPANY_CONTEXT_MESSAGE };
  }

  const companies = await listSwitcherCompanies(principal, store);
  const accessibleCompanyIds = companies.map((company) => company.id);

  const trimmed = rawValue.trim();
  const selection: CompanyContextSelection | null =
    trimmed === ALL_COMPANIES_CONTEXT_VALUE
      ? { kind: "all" }
      : trimmed.length > 0
        ? { kind: "company", companyId: trimmed }
        : null;

  if (!selection || !isSelectionAllowed(scope, selection, accessibleCompanyIds)) {
    return { ok: false, status: 400, error: INVALID_COMPANY_CONTEXT_MESSAGE };
  }

  // Re-resolve to ensure cookie round-trip matches domain rules.
  const resolved = resolveCompanyContext({
    principal,
    rawSelection: serializeCompanyContextSelection(selection),
    accessibleCompanyIds,
  });
  if (resolved.status !== "resolved") {
    return { ok: false, status: 400, error: INVALID_COMPANY_CONTEXT_MESSAGE };
  }

  await writeCompanyContextCookie(serializeCompanyContextSelection(resolved.selection));
  return { ok: true, data: resolved.selection };
}

export async function getResolvedCompanyContext(
  principal: AuthorizationPrincipal | null,
  store: CompanyContextStore = createDefaultCompanyContextStore(),
): Promise<ResolvedCompanyContext> {
  const view = await getCompanyContextView(principal, store);
  return view.resolved;
}

export async function clearCompanyContext(): Promise<void> {
  await clearCompanyContextCookie();
}
