import { z } from "zod";

import { ROLE_CODES } from "@/domain/authz/roles";

export const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

const companyIdsSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === false) {
    return [];
  }
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item) => typeof item === "string" && item.length > 0))];
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}, z.array(z.uuid()));

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Full name is required").max(200),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(320)),
  roleCode: z.enum(ROLE_CODES),
  employeeId: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  mfaEnabled: z.boolean().optional().default(false),
  passwordResetRequired: z.boolean().optional().default(true),
  status: userStatusSchema.optional().default("ACTIVE"),
  companyIds: companyIdsSchema.optional().default([]),
});

export type CreateUserInput = z.output<typeof createUserSchema>;
export type CreateUserFormValues = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Full name is required").max(200),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(320)),
  roleCode: z.enum(ROLE_CODES),
  employeeId: z.union([z.string().trim().max(100), z.null()]).transform((value) => {
    if (value === null) {
      return null;
    }
    return value.length > 0 ? value : null;
  }),
  mfaEnabled: z.boolean(),
  status: userStatusSchema,
  passwordResetRequired: z.boolean(),
  companyIds: companyIdsSchema,
});

export type UpdateUserInput = z.output<typeof updateUserSchema>;
export type UpdateUserFormValues = z.input<typeof updateUserSchema>;

export const suspendUserSchema = z.object({
  status: z.literal("SUSPENDED"),
});
