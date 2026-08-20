import { z } from "zod";

export const currencyStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const currencyIdSchema = z.uuid();

const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency code must be a 3-letter ISO-style code.");

export const currencyWriteSchema = z.strictObject({
  code: currencyCodeSchema,
  name: z.string().trim().min(1, "Name is required").max(100),
  symbol: z.string().trim().min(1, "Symbol is required").max(16),
  decimalPrecision: z.coerce.number().int().min(0).max(6),
  status: currencyStatusSchema.optional().default("ACTIVE"),
});

export type CurrencyWriteInput = z.output<typeof currencyWriteSchema>;
/** Form defaults use numbers; coerce still accepts string inputs at parse time. */
export type CurrencyWriteFormValues = {
  code: string;
  name: string;
  symbol: string;
  decimalPrecision: number;
  status?: "ACTIVE" | "INACTIVE";
};

export const currencyUpdateSchema = z.strictObject({
  name: z.string().trim().min(1, "Name is required").max(100),
  symbol: z.string().trim().min(1, "Symbol is required").max(16),
  decimalPrecision: z.coerce.number().int().min(0).max(6),
  status: currencyStatusSchema,
});

export type CurrencyUpdateInput = z.output<typeof currencyUpdateSchema>;

export const currencyStatusUpdateSchema = z.strictObject({
  status: currencyStatusSchema,
});
