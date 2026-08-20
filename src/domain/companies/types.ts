export type CompanyStatus = "ACTIVE" | "INACTIVE";

/**
 * Company/brand identity record for Admin CRUD.
 * Branding (prefix, terms, email template reference, logo metadata) lives on the
 * branding subresource. Does not include gateway credentials, currencies,
 * invoice sequence, reporting groups, or user assignments.
 */
export interface CompanyRecord {
  readonly id: string;
  readonly displayName: string;
  readonly legalName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly registrationTaxNumber: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string | null;
  readonly status: CompanyStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const COMPANY_NOT_FOUND_MESSAGE = "Company not found.";
export const COMPANY_INVALID_INPUT = "Check the company details and try again.";
export const COMPANY_UNAVAILABLE = "Company management is temporarily unavailable.";
