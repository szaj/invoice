export type CustomerType = "INDIVIDUAL" | "BUSINESS";
export type CustomerStatus = "ACTIVE" | "INACTIVE";

/**
 * Customer master record (Customers §7.1).
 * Not company-owned; multi-company linkage via customer_companies (TASK-025).
 * defaultCompanyId is a preference only. Soft status; no hard-delete.
 * companyIds are the authorization boundary for Staff/Compliance.
 */
export type CustomerRecord = {
  readonly id: string;
  readonly displayName: string;
  readonly contactPerson: string | null;
  readonly customerType: CustomerType;
  readonly email: string | null;
  readonly phone: string | null;
  readonly alternatePhone: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string | null;
  readonly taxRegistrationId: string | null;
  readonly website: string | null;
  readonly defaultInvoiceCurrencyCode: string | null;
  readonly defaultCompanyId: string | null;
  readonly paymentPreference: string | null;
  readonly status: CustomerStatus;
  readonly assignedStaffUserId: string | null;
  readonly internalNotes: string | null;
  readonly tags: readonly string[];
  readonly companyIds: readonly string[];
  readonly createdByUserId: string | null;
  readonly updatedByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export const CUSTOMER_NOT_FOUND = "Customer not found.";
export const CUSTOMER_INVALID_INPUT = "Check the customer details and try again.";
export const CUSTOMER_UNAVAILABLE = "Customer management is temporarily unavailable.";
export const CUSTOMER_COMPANY_REQUIRED =
  "Link this customer to at least one company you can access.";
export const CUSTOMER_DEFAULT_COMPANY_NOT_LINKED =
  "Default company must be one of the linked companies.";
export const CUSTOMER_STATUS_FORBIDDEN =
  "Customer deactivation requires delete permission. Use the deactivate action.";
export const CUSTOMER_DUPLICATE_CODE = "CUSTOMER_DUPLICATE_WARNING" as const;
