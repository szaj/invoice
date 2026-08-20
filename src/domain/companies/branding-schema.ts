import { z } from "zod";

function blankToNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const nullableText = (max: number) => z.preprocess(blankToNull, z.string().max(max).nullable());

const nullableEmail = z.preprocess((value) => {
  const next = blankToNull(value);
  return typeof next === "string" ? next.toLowerCase() : next;
}, z.email("Enter a valid email address").max(320).nullable());

const nullableWebsite = z.preprocess(
  blankToNull,
  z
    .url({ error: "Enter a valid website URL", protocol: /^https?$/ })
    .max(2048)
    .nullable(),
);

const nullableInvoicePrefix = z.preprocess(
  blankToNull,
  z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*-?$/, "Use a company-specific prefix such as VX-")
    .nullable(),
);

/**
 * Branding write payload. Identity/address/status remain on company CRUD.
 * Invoice sequence is excluded (TASK-035).
 */
export const companyBrandingWriteSchema = z.strictObject({
  email: nullableEmail,
  phone: nullableText(50),
  website: nullableWebsite,
  invoicePrefix: nullableInvoicePrefix,
  termsAndConditions: nullableText(20_000),
  emailTemplateReference: nullableText(200),
});

export type CompanyBrandingWriteInput = z.output<typeof companyBrandingWriteSchema>;
export type CompanyBrandingWriteFormValues = z.input<typeof companyBrandingWriteSchema>;
