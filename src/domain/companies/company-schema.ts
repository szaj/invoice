import { z } from "zod";

import { isIsoCountryCode } from "@/domain/companies/countries";

export const companyStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const companyIdSchema = z.uuid();

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

const nullableCountry = z.preprocess((value) => {
  const next = blankToNull(value);
  return typeof next === "string" ? next.toUpperCase() : next;
}, z.string().length(2).refine(isIsoCountryCode, "Select a valid ISO country").nullable());

export const companyWriteSchema = z.strictObject({
  displayName: z.string().trim().min(1, "Display name is required").max(200),
  legalName: nullableText(200),
  email: nullableEmail,
  phone: nullableText(50),
  website: nullableWebsite,
  registrationTaxNumber: nullableText(100),
  addressLine1: nullableText(200),
  addressLine2: nullableText(200),
  city: nullableText(100),
  region: nullableText(100),
  postalCode: nullableText(20),
  countryCode: nullableCountry,
  status: companyStatusSchema.optional().default("ACTIVE"),
});

export type CompanyWriteInput = z.output<typeof companyWriteSchema>;
export type CompanyWriteFormValues = z.input<typeof companyWriteSchema>;

export const companyStatusUpdateSchema = z.strictObject({
  status: companyStatusSchema,
});
