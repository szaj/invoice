import { z } from "zod";

const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency code must be a 3-letter ISO-style code.");

/**
 * Admin-defined fixed rate as a decimal string.
 * Stored as NUMERIC(20, 12); up to 12 fractional digits; never JS float math.
 */
export const fixedRateDecimalSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,12})?$/, "Fixed rate must be a positive decimal with up to 12 places.")
  .refine((value) => !/^0+(\.0+)?$/.test(value), "Fixed rate must be greater than zero.")
  .refine((value) => {
    const whole = value.split(".")[0] ?? value;
    return whole.length <= 8;
  }, "Fixed rate integer part must fit NUMERIC(20, 12).");

export const fixedRateFrequencySchema = z.enum(["MONTHLY", "YEARLY", "MANUAL"]);

export const fixedConversionRateCreateSchema = z
  .strictObject({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    fixedRate: fixedRateDecimalSchema,
    frequencyLabel: fixedRateFrequencySchema,
    validFrom: z.coerce.date(),
    validTo: z.coerce.date().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.fromCurrency === value.toCurrency) {
      ctx.addIssue({
        code: "custom",
        message: "From and to currencies must be different.",
        path: ["toCurrency"],
      });
    }
    if (value.validTo && value.validTo.getTime() < value.validFrom.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: "Valid to must be on or after valid from.",
        path: ["validTo"],
      });
    }
  });

export type FixedConversionRateCreateInput = z.output<typeof fixedConversionRateCreateSchema>;
export type FixedConversionRateCreateFormValues = {
  fromCurrency: string;
  toCurrency: string;
  fixedRate: string;
  frequencyLabel: "MONTHLY" | "YEARLY" | "MANUAL";
  validFrom: string;
  validTo: string;
  notes: string;
};
