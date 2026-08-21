import { describe, expect, it } from "vitest";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

describe.skipIf(!runDbIntegration)("payment domain schema integration", () => {
  it("creates payments table with provider-agnostic money columns", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    expect(tables.map((row) => row.table_name)).toContain("payments");

    const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payments'
      ORDER BY column_name
    `;
    const byName = new Map(columns.map((col) => [col.column_name, col.data_type]));
    expect(byName.get("company_id")).toBe("uuid");
    expect(byName.get("invoice_id")).toBe("uuid");
    expect(byName.get("customer_id")).toBe("uuid");
    expect(byName.get("method_code")).toBeTruthy();
    expect(byName.get("invoice_amount_applied")).toBe("numeric");
    expect(byName.get("fixed_conversion_rate")).toBe("numeric");
    expect(byName.get("converted_settlement_amount")).toBe("numeric");
    expect(byName.get("processor_fee_amount")).toBe("numeric");
    expect(byName.get("actual_received_amount")).toBe("numeric");
    expect(byName.has("stripe_payment_intent_id")).toBe(false);
    expect(byName.has("api_key")).toBe(false);
  }, 30_000);
});
