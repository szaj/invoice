export type CompanyLogoMetadata = {
  readonly storageKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly originalFilename: string | null;
  readonly uploadedAt: Date;
};

/**
 * Company branding subresource used later by invoices, PDFs, and email.
 * Contact fields mirror Companies and Brands §5.1 brand contact details.
 * Invoice sequence issuance remains TASK-035.
 */
export type CompanyBrandingRecord = {
  readonly companyId: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly website: string | null;
  readonly invoicePrefix: string | null;
  readonly termsAndConditions: string | null;
  readonly emailTemplateReference: string | null;
  readonly logo: CompanyLogoMetadata | null;
  readonly updatedAt: Date;
};

export const COMPANY_BRANDING_INVALID_INPUT = "Check the branding details and try again.";
export const COMPANY_BRANDING_INVALID_UPLOAD = "The logo upload is invalid.";
export const COMPANY_BRANDING_UNAVAILABLE = "Company branding is temporarily unavailable.";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoAllowedMimeType = (typeof LOGO_ALLOWED_MIME_TYPES)[number];
