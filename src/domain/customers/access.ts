import { assignedCompanyIdsOf, companyScopeForRole } from "@/domain/authz/company-access";
import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import type { CustomerRecord } from "@/domain/customers/types";

export class CustomerDomainError extends Error {
  readonly status: 400;

  constructor(message: string) {
    super(message);
    this.name = "CustomerDomainError";
    this.status = 400;
  }
}

export function isCustomerDomainError(error: unknown): error is CustomerDomainError {
  return error instanceof CustomerDomainError;
}

/**
 * Company-scoped customer visibility via customer_companies (TASK-025).
 * Admin: all. Compliance/Staff: any linked company intersects assigned companies.
 */
export function canAccessCustomer(
  principal: AuthorizationPrincipal | null,
  customer: Pick<CustomerRecord, "companyIds">,
): boolean {
  if (!principal || principal.status !== "ACTIVE" || !principal.roleCode) {
    return false;
  }

  const scope = companyScopeForRole(principal.roleCode);
  if (scope === "ALL") {
    return true;
  }

  const assigned = new Set(assignedCompanyIdsOf(principal));
  return customer.companyIds.some((companyId) => assigned.has(companyId));
}

/**
 * Companies the actor may see for this customer on profile/summary (linked ∩ authorized).
 * Unassigned linked companies are omitted for Staff/Compliance.
 */
export function authorizedCustomerCompanyIds(
  actor: AuthorizationPrincipal,
  linkedCompanyIds: readonly string[],
): string[] {
  const scope = companyScopeForRole(actor.roleCode);
  if (scope === "ALL") {
    return [...linkedCompanyIds];
  }
  const assigned = new Set(assignedCompanyIdsOf(actor));
  return linkedCompanyIds.filter((id) => assigned.has(id));
}

/**
 * Merge requested company links with existing links outside the actor's authority.
 * Staff/Compliance may only add/remove companies they are assigned to.
 * Admin replaces the full set.
 */
export function mergeCustomerCompanyLinks(input: {
  readonly actor: AuthorizationPrincipal;
  readonly existingCompanyIds: readonly string[];
  readonly requestedCompanyIds: readonly string[];
}): string[] {
  const scope = companyScopeForRole(input.actor.roleCode);
  const requested = [...new Set(input.requestedCompanyIds)];

  if (scope === "ALL") {
    return requested;
  }

  const assigned = new Set(assignedCompanyIdsOf(input.actor));
  const preserved = input.existingCompanyIds.filter((id) => !assigned.has(id));
  const nextOwned = requested.filter((id) => assigned.has(id));
  return [...new Set([...preserved, ...nextOwned])];
}
