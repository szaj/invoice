import { z } from "zod";

import { PAYMENT_METHOD_CODES } from "@/domain/settlement/types";

const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency code must be a 3-letter ISO-style code.");

export const paymentMethodCodeSchema = z.enum(PAYMENT_METHOD_CODES);

export const paymentMethodSettlementWriteSchema = z.strictObject({
  methodEnabled: z.boolean(),
  enabledSettlementCurrencyCodes: z.array(currencyCodeSchema).max(50),
});

export type PaymentMethodSettlementWriteInput = z.infer<typeof paymentMethodSettlementWriteSchema>;

export const assertSettlementCurrencyInputSchema = z.strictObject({
  methodCode: paymentMethodCodeSchema,
  settlementCurrencyCode: currencyCodeSchema,
});
