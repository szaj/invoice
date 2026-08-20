/**
 * Per-request company context for tenant isolation (TASK-009).
 * Cookie/session storage only — no new financial tables.
 *
 * Admin may select All Companies for consolidated reporting.
 * Transactional actions require one concrete company.
 * Reporting-group membership is not company context.
 */

export const ALL_COMPANIES_CONTEXT_VALUE = "all" as const;

export type CompanyContextSelection =
  { readonly kind: "all" } | { readonly kind: "company"; readonly companyId: string };

export type ResolvedCompanyContext =
  | { readonly status: "resolved"; readonly selection: CompanyContextSelection }
  | { readonly status: "unresolved"; readonly reason: CompanyContextUnresolvedReason };

export type CompanyContextUnresolvedReason =
  | "unauthenticated"
  | "suspended"
  | "missing_role"
  | "no_accessible_companies"
  | "invalid_selection";

export const INVALID_COMPANY_CONTEXT_MESSAGE = "Invalid company context.";
export const CONCRETE_COMPANY_REQUIRED_MESSAGE = "Select a company before performing this action.";
export const COMPANY_CONTEXT_MISMATCH_MESSAGE = "Invalid company context.";
