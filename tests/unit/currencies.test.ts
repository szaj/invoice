import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import { currencyWriteSchema } from "@/domain/currencies/schema";
import { DEFAULT_CURRENCY_CODES, type CurrencyRecord } from "@/domain/currencies/types";
import {
  createCurrency,
  listCurrencies,
  setCurrencyStatus,
  updateCurrency,
  type CurrencyManagementDependencies,
} from "@/server/currencies/currency-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

function principal(roleCode: RoleCode | null): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
  };
}

function currencyRecord(overrides: Partial<CurrencyRecord> = {}): CurrencyRecord {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-000000000099",
    code: "CAD",
    name: "Canadian Dollar",
    symbol: "C$",
    decimalPrecision: 2,
    status: "ACTIVE",
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

function createDeps(seed: CurrencyRecord[] = []): CurrencyManagementDependencies & {
  store: { currencies: CurrencyRecord[] };
} {
  const currencies = [...seed];
  const store = {
    currencies,
    async listCurrencies() {
      return [...currencies].sort((a, b) => a.code.localeCompare(b.code));
    },
    async getCurrencyById(id: string) {
      return currencies.find((currency) => currency.id === id) ?? null;
    },
    async findByCode(code: string) {
      return currencies.find((currency) => currency.code === code) ?? null;
    },
    async createCurrency(input: {
      code: string;
      name: string;
      symbol: string;
      decimalPrecision: number;
      status: "ACTIVE" | "INACTIVE";
    }) {
      const created = currencyRecord({
        id: "dddddddd-dddd-4ddd-8ddd-000000000100",
        ...input,
      });
      currencies.push(created);
      return created;
    },
    async updateCurrency(
      id: string,
      input: {
        name: string;
        symbol: string;
        decimalPrecision: number;
        status: "ACTIVE" | "INACTIVE";
      },
    ) {
      const index = currencies.findIndex((currency) => currency.id === id);
      const updated = currencyRecord({ ...currencies[index], ...input, id });
      currencies[index] = updated;
      return updated;
    },
    async setStatus(id: string, status: "ACTIVE" | "INACTIVE") {
      const index = currencies.findIndex((currency) => currency.id === id);
      const current = currencies[index];
      if (!current) {
        throw new Error("missing");
      }
      const updated = { ...current, status };
      currencies[index] = updated;
      return updated;
    },
  };

  return {
    store,
    auditWriter: createMemoryAuditWriter(),
  };
}

describe("currency write schema", () => {
  it("requires ISO-style code and non-negative decimal precision", () => {
    expect(
      currencyWriteSchema.safeParse({
        code: "eur",
        name: "Euro",
        symbol: "€",
        decimalPrecision: 2,
      }).success,
    ).toBe(true);
    expect(
      currencyWriteSchema.safeParse({
        code: "EU",
        name: "Euro",
        symbol: "€",
        decimalPrecision: 2,
      }).success,
    ).toBe(false);
    expect(
      currencyWriteSchema.safeParse({
        code: "EUR",
        name: "Euro",
        symbol: "€",
        decimalPrecision: -1,
      }).success,
    ).toBe(false);
  });
});

describe("default currency catalog", () => {
  it("defines the five Version 1 default currency codes", () => {
    expect([...DEFAULT_CURRENCY_CODES].sort()).toEqual(["AED", "AUD", "GBP", "PKR", "USD"].sort());
  });
});

describe("currency management authorization", () => {
  it("allows Admin list/create and denies Non-Admin create", async () => {
    const deps = createDeps([
      currencyRecord({ id: "1", code: "USD", name: "US Dollar", symbol: "$" }),
    ]);

    const listed = await listCurrencies(principal("ADMIN"), deps);
    expect(listed.ok).toBe(true);

    const staffCreate = await createCurrency(
      principal("STAFF"),
      {
        code: "EUR",
        name: "Euro",
        symbol: "€",
        decimalPrecision: 2,
      },
      deps,
    );
    expect(staffCreate.ok).toBe(false);
    if (!staffCreate.ok) {
      expect(staffCreate.status).toBe(403);
      expect(staffCreate.error).toBe(GENERIC_FORBIDDEN);
    }
  });

  it("creates, updates, and disables currencies with audit for Admin", async () => {
    const auditWriter = createMemoryAuditWriter();
    const deps = { ...createDeps(), auditWriter };

    const created = await createCurrency(
      principal("ADMIN"),
      {
        code: "EUR",
        name: "Euro",
        symbol: "€",
        decimalPrecision: 2,
      },
      deps,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("create failed");
    }

    const updated = await updateCurrency(
      principal("ADMIN"),
      created.data.id,
      {
        name: "Eurozone Euro",
        symbol: "€",
        decimalPrecision: 2,
        status: "ACTIVE",
      },
      deps,
    );
    expect(updated.ok).toBe(true);

    const disabled = await setCurrencyStatus(
      principal("ADMIN"),
      created.data.id,
      { status: "INACTIVE" },
      deps,
    );
    expect(disabled.ok).toBe(true);
    if (disabled.ok) {
      expect(disabled.data.status).toBe("INACTIVE");
    }

    expect(auditWriter.events.map((event) => event.action)).toEqual([
      "currencies.created",
      "currencies.updated",
      "currencies.status_changed",
    ]);
  });
});
