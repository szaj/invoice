import "server-only";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { assignedCompanyIdsOf, companyScopeForRole } from "@/domain/authz/company-access";
import type { CompanyRecord } from "@/domain/companies/types";
import { PrismaCompanyStore } from "@/server/companies/company-repository";

export interface CompanyContextStore {
  listCompanies(): Promise<CompanyRecord[]>;
  listCompaniesByIds(ids: readonly string[]): Promise<CompanyRecord[]>;
}

export function createDefaultCompanyContextStore(): CompanyContextStore {
  return new PrismaCompanyStore();
}

/**
 * Companies visible in the header switcher.
 * Admin: all companies. Compliance/Staff: assigned only.
 * Reporting groups are ignored.
 */
export async function listSwitcherCompanies(
  principal: AuthorizationPrincipal | null,
  store: CompanyContextStore = createDefaultCompanyContextStore(),
): Promise<CompanyRecord[]> {
  if (!principal?.roleCode || principal.status !== "ACTIVE") {
    return [];
  }

  const scope = companyScopeForRole(principal.roleCode);
  if (scope === "ALL") {
    return store.listCompanies();
  }
  if (scope === "ASSIGNED") {
    return store.listCompaniesByIds(assignedCompanyIdsOf(principal));
  }
  return [];
}
