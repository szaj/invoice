import { z } from "zod";

import { GATEWAY_ENVIRONMENTS } from "@/domain/gateway-config/types";
import { paymentMethodCodeSchema } from "@/domain/settlement/schema";

export { paymentMethodCodeSchema };

export const gatewayEnvironmentSchema = z.enum(GATEWAY_ENVIRONMENTS);

/** Non-secret provider config: JSON object with string/number/boolean/null values only. */
const providerConfigValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const providerConfigSchema = z
  .record(z.string().min(1).max(64), providerConfigValueSchema)
  .refine((value) => Object.keys(value).length <= 32, "Too many provider config keys.")
  .nullable();

/**
 * Opaque credential map. All values are strings; keys are short identifiers.
 * Never logged or returned after write.
 */
export const gatewayCredentialsPayloadSchema = z
  .record(z.string().min(1).max(64), z.string().min(1).max(4096))
  .refine((value) => Object.keys(value).length >= 1, "Credentials payload must not be empty.")
  .refine((value) => Object.keys(value).length <= 32, "Too many credential keys.");

/**
 * Non-secret PATCH. Omitting credentials preserves existing encrypted material (ADR-022).
 */
export const gatewayMethodConfigWriteSchema = z
  .object({
    methodEnabled: z.boolean().optional(),
    environment: gatewayEnvironmentSchema.nullable().optional(),
    providerConfig: providerConfigSchema.optional(),
  })
  .refine(
    (value) =>
      value.methodEnabled !== undefined ||
      value.environment !== undefined ||
      value.providerConfig !== undefined,
    "At least one configuration field is required.",
  );

/**
 * Explicit credential replacement. Must be sent to the credentials endpoint (or with replace flag).
 */
export const gatewayCredentialsReplaceSchema = z.object({
  credentials: gatewayCredentialsPayloadSchema,
});
