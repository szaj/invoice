import { z } from "zod";

export const companyCurrencyConfigWriteSchema = z
  .strictObject({
    enabledCurrencyIds: z.array(z.uuid()).max(200),
    defaultCurrencyId: z.uuid().nullable(),
  })
  .superRefine((value, ctx) => {
    const unique = new Set(value.enabledCurrencyIds);
    if (unique.size !== value.enabledCurrencyIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Enabled currencies must be unique.",
        path: ["enabledCurrencyIds"],
      });
    }

    if (value.enabledCurrencyIds.length === 0) {
      if (value.defaultCurrencyId !== null) {
        ctx.addIssue({
          code: "custom",
          message: "Clear the default when no currencies are enabled.",
          path: ["defaultCurrencyId"],
        });
      }
      return;
    }

    if (value.defaultCurrencyId === null) {
      ctx.addIssue({
        code: "custom",
        message: "Choose a default invoice currency from the enabled set.",
        path: ["defaultCurrencyId"],
      });
      return;
    }

    if (!unique.has(value.defaultCurrencyId)) {
      ctx.addIssue({
        code: "custom",
        message: "The default invoice currency must be one of the enabled currencies.",
        path: ["defaultCurrencyId"],
      });
    }
  });

export type CompanyCurrencyConfigWriteInput = z.infer<typeof companyCurrencyConfigWriteSchema>;
