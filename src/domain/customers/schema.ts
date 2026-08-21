import { z } from "zod";

import { isIsoCountryCode } from "@/domain/companies/countries";

export const customerTypeSchema = z.enum(["INDIVIDUAL", "BUSINESS"]);
export const customerStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const customerIdSchema = z.uuid();

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

/** Email optional at create (Customers §7.3 / BR-017 applies only when emailing invoices). */
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

const nullableCurrencyCode = z.preprocess(
  (value) => {
    const next = blankToNull(value);
    return typeof next === "string" ? next.toUpperCase() : next;
  },
  z
    .string()
    .regex(/^[A-Z]{3}$/, "Currency code must be a 3-letter ISO-style code.")
    .nullable(),
);

const nullableUuid = z.preprocess(blankToNull, z.uuid().nullable());

const tagsSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(50)
  .default([])
  .transform((tags) => [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]);

const companyIdsSchema = z
  .array(z.uuid())
  .max(200)
  .default([])
  .transform((ids) => [...new Set(ids)]);

export const customerWriteSchema = z.strictObject({
  displayName: z.string().trim().min(1, "Customer name is required").max(200),
  contactPerson: nullableText(200),
  customerType: customerTypeSchema,
  email: nullableEmail,
  phone: nullableText(50),
  alternatePhone: nullableText(50),
  addressLine1: nullableText(200),
  addressLine2: nullableText(200),
  city: nullableText(100),
  region: nullableText(100),
  postalCode: nullableText(20),
  countryCode: nullableCountry,
  taxRegistrationId: nullableText(100),
  website: nullableWebsite,
  defaultInvoiceCurrencyCode: nullableCurrencyCode,
  defaultCompanyId: nullableUuid,
  paymentPreference: nullableText(100),
  status: customerStatusSchema.optional().default("ACTIVE"),
  assignedStaffUserId: nullableUuid,
  internalNotes: nullableText(5000),
  tags: tagsSchema,
  companyIds: companyIdsSchema,
  /** Admin/Compliance may set true after a duplicate warning (TASK-028). Not persisted. */
  acknowledgeDuplicates: z.boolean().optional().default(false),
});

export type CustomerWriteInput = z.output<typeof customerWriteSchema>;
export type CustomerWriteFormValues = z.input<typeof customerWriteSchema>;
export type CustomerPersistedWriteInput = Omit<CustomerWriteInput, "acknowledgeDuplicates">;

export function toCustomerPersistedWriteInput(
  input: CustomerWriteInput,
): CustomerPersistedWriteInput {
  const { acknowledgeDuplicates: _ack, ...persisted } = input;
  void _ack;
  return persisted;
}

export const customerUpdateSchema = customerWriteSchema;

export type CustomerUpdateInput = z.output<typeof customerUpdateSchema>;

export const customerStatusUpdateSchema = z.strictObject({
  status: customerStatusSchema,
});

export const customerSearchSchema = z.strictObject({
  q: z.string().trim().max(200).optional(),
  status: customerStatusSchema.optional(),
  companyId: z.uuid().optional(),
});

export type CustomerSearchInput = z.output<typeof customerSearchSchema>;

export const customerProfileQuerySchema = z.strictObject({
  companyId: z.uuid().optional(),
});

export type CustomerProfileQuery = z.output<typeof customerProfileQuerySchema>;

export const customerCompaniesUpdateSchema = z.strictObject({
  companyIds: companyIdsSchema,
});

export type CustomerCompaniesUpdateInput = z.output<typeof customerCompaniesUpdateSchema>;

export const customerCompanyLinkSchema = z.strictObject({
  companyId: z.uuid(),
});

export type CustomerCompanyLinkInput = z.output<typeof customerCompanyLinkSchema>;
