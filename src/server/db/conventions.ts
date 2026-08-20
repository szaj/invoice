/**
 * Database conventions for later domain models.
 * Do not invent customers/invoices/payments here.
 */

export const DATABASE_CONVENTIONS = {
  id: {
    prisma: 'String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid',
    notes: "Immutable UUID for externally referenced application records.",
  },
  companyId: {
    prisma: "String @db.Uuid",
    notes: "Required on transactional tables. Authorization still lives in the application domain.",
  },
  createdAt: {
    prisma: "DateTime @default(now()) @db.Timestamptz",
    notes: "Authoritative timestamps are UTC.",
  },
  updatedAt: {
    prisma: "DateTime @updatedAt @db.Timestamptz",
    notes: "Authoritative timestamps are UTC.",
  },
  money: {
    prisma: "Decimal @db.Decimal(19, 4)",
    native: "NUMERIC(19, 4)",
    notes: "Never Float/Double. Never JavaScript number arithmetic for money.",
  },
  conversionRate: {
    prisma: "Decimal @db.Decimal(20, 12)",
    native: "NUMERIC(20, 12)",
    notes: "Fixed conversion rates need 8–12 decimal places.",
  },
} as const;

export const FORBIDDEN_MONEY_PRISMA_TYPES = ["Float", "Double"] as const;
