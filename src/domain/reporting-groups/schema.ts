import { z } from "zod";

export const reportingGroupStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const reportingGroupIdSchema = z.uuid();

function blankToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

const companyIdsSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return value;
}, z.array(z.uuid()).max(500));

export const reportingGroupWriteSchema = z.strictObject({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z.preprocess(
    (value) => {
      const next = blankToUndefined(value);
      return typeof next === "string" ? next.toUpperCase() : next;
    },
    z
      .string()
      .min(1, "Code is required")
      .max(32)
      .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Use a code such as VX"),
  ),
  status: reportingGroupStatusSchema.optional().default("ACTIVE"),
  displayOrder: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  companyIds: companyIdsSchema.optional().default([]),
});

export type ReportingGroupWriteInput = z.output<typeof reportingGroupWriteSchema>;
export type ReportingGroupWriteFormValues = z.input<typeof reportingGroupWriteSchema>;

export const reportingGroupStatusUpdateSchema = z.strictObject({
  status: reportingGroupStatusSchema,
});
