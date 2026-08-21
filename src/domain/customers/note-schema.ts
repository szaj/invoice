import { z } from "zod";

import { customerIdSchema } from "@/domain/customers/schema";

export const customerNoteCreateSchema = z.strictObject({
  body: z.string().trim().min(1, "Note text is required").max(5000),
});

export type CustomerNoteCreateInput = z.output<typeof customerNoteCreateSchema>;

export const customerNoteListQuerySchema = z.strictObject({
  customerId: customerIdSchema,
});
