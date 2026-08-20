import { z } from "zod";

const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Reporting currency must be a 3-letter code.");

function isKnownTimezone(value: string): boolean {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone").includes(value);
    }
  } catch {
    // Fall through to structural check.
  }
  return /^[A-Za-z0-9_+\-/]+$/.test(value) && value.length >= 1 && value.length <= 64;
}

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isKnownTimezone, "Default timezone must be a valid IANA time zone.");

/**
 * Rounding tolerance placeholder for later money utilities.
 * Stored/validated as a decimal string — never authoritative JS number math.
 */
const roundingToleranceSchema = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,4})?$/, "Rounding tolerance must be a decimal with up to 4 places.")
  .refine((value) => {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 && amount <= 1;
  }, "Rounding tolerance must be between 0 and 1 inclusive.");

export const systemSettingsUpdateSchema = z.object({
  reportingCurrencyCode: currencyCodeSchema,
  defaultTimezone: timezoneSchema,
  roundingTolerance: roundingToleranceSchema,
});

export type SystemSettingsUpdateInput = z.infer<typeof systemSettingsUpdateSchema>;
export type SystemSettingsUpdateFormValues = {
  reportingCurrencyCode: string;
  defaultTimezone: string;
  roundingTolerance: string;
};
