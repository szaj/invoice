import { describe, expect, it } from "vitest";

import {
  assertCurrencySelectableForNewDocument,
  currenciesForNewDocumentPicker,
  currencyLabelForHistoricalDisplay,
  isCurrencySelectableForNewDocument,
} from "@/domain/currencies/selection";
import {
  CURRENCY_DISABLED_FOR_NEW_SELECTION,
  CURRENCY_NOT_ENABLED_FOR_COMPANY,
  type CurrencyRecord,
} from "@/domain/currencies/types";
import {
  listCurrenciesForNewDocument,
  resolveCurrencyForHistoricalDisplay,
  validateCurrencyForNewDocument,
  type CurrencySelectionDependencies,
} from "@/server/currencies/currency-selection-service";
import type { CompanyCurrencyConfiguration } from "@/domain/companies/company-currency-types";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USD_ID = "dddddddd-dddd-4ddd-8ddd-000000000001";
const AED_ID = "dddddddd-dddd-4ddd-8ddd-000000000002";
const GBP_ID = "dddddddd-dddd-4ddd-8ddd-000000000003";
const DISABLED_ID = "dddddddd-dddd-4ddd-8ddd-000000000099";

function currencyRecord(overrides: Partial<CurrencyRecord> = {}): CurrencyRecord {
  return {
    id: DISABLED_ID,
    code: "XXX",
    name: "Disabled Dollar",
    symbol: "X",
    decimalPrecision: 2,
    status: "INACTIVE",
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides,
  };
}

function companyConfig(): CompanyCurrencyConfiguration {
  return {
    companyId: COMPANY_ID,
    companyDisplayName: "Virtue Xolutions",
    currencies: [
      {
        currencyId: USD_ID,
        code: "USD",
        name: "US Dollar",
        symbol: "$",
        decimalPrecision: 2,
        globalStatus: "ACTIVE",
        enabled: true,
        isDefault: true,
      },
      {
        currencyId: AED_ID,
        code: "AED",
        name: "UAE Dirham",
        symbol: "AED",
        decimalPrecision: 2,
        globalStatus: "ACTIVE",
        enabled: false,
        isDefault: false,
      },
      {
        currencyId: GBP_ID,
        code: "GBP",
        name: "Pound Sterling",
        symbol: "£",
        decimalPrecision: 2,
        globalStatus: "ACTIVE",
        enabled: true,
        isDefault: false,
      },
      {
        currencyId: DISABLED_ID,
        code: "XXX",
        name: "Disabled Dollar",
        symbol: "X",
        decimalPrecision: 2,
        globalStatus: "INACTIVE",
        enabled: true,
        isDefault: false,
      },
    ],
    enabledCurrencyIds: [USD_ID, GBP_ID, DISABLED_ID],
    defaultCurrencyId: USD_ID,
  };
}

function createDeps(
  config: CompanyCurrencyConfiguration = companyConfig(),
  catalog: CurrencyRecord[] = [
    currencyRecord({ id: USD_ID, code: "USD", name: "US Dollar", symbol: "$", status: "ACTIVE" }),
    currencyRecord({
      id: DISABLED_ID,
      code: "XXX",
      name: "Disabled Dollar",
      symbol: "X",
      status: "INACTIVE",
    }),
  ],
): CurrencySelectionDependencies {
  return {
    companyCurrencyStore: {
      async companyExists() {
        return true;
      },
      async getCompanyCurrencyConfiguration() {
        return config;
      },
    },
    currencyStore: {
      async getCurrencyById(id: string) {
        return catalog.find((currency) => currency.id === id) ?? null;
      },
      async findByCode(code: string) {
        return catalog.find((currency) => currency.code === code) ?? null;
      },
    },
  };
}

describe("currency new-selection vs historical visibility", () => {
  it("rejects new selection when currency is globally disabled", () => {
    const result = assertCurrencySelectableForNewDocument({
      globalStatus: "INACTIVE",
      companyEnabled: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(CURRENCY_DISABLED_FOR_NEW_SELECTION);
    }
    expect(
      isCurrencySelectableForNewDocument({
        globalStatus: "INACTIVE",
        companyEnabled: true,
      }),
    ).toBe(false);
  });

  it("rejects new selection when currency is not company-enabled", () => {
    const result = assertCurrencySelectableForNewDocument({
      globalStatus: "ACTIVE",
      companyEnabled: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(CURRENCY_NOT_ENABLED_FOR_COMPANY);
    }
  });

  it("allows new selection when active and company-enabled", () => {
    expect(
      assertCurrencySelectableForNewDocument({
        globalStatus: "ACTIVE",
        companyEnabled: true,
      }),
    ).toEqual({ ok: true });
  });

  it("hides disabled currencies from new-document picker options", () => {
    const options = currenciesForNewDocumentPicker(
      companyConfig().currencies.map((currency) => ({
        currencyId: currency.currencyId,
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimalPrecision: currency.decimalPrecision,
        globalStatus: currency.globalStatus,
        companyEnabled: currency.enabled,
      })),
    );
    expect(options.map((row) => row.code)).toEqual(["USD", "GBP"]);
    expect(options.some((row) => row.code === "XXX")).toBe(false);
    expect(options.some((row) => row.code === "AED")).toBe(false);
  });

  it("keeps disabled currency labels available for historical display", () => {
    const label = currencyLabelForHistoricalDisplay({
      code: "xxx",
      name: "Disabled Dollar",
      symbol: "X",
      status: "INACTIVE",
    });
    expect(label).toContain("XXX");
    expect(label).toContain("Disabled Dollar");
    expect(label).toContain("[disabled]");
  });
});

describe("currency selection validation hooks", () => {
  it("validateCurrencyForNewDocument rejects a disabled currency", async () => {
    const result = await validateCurrencyForNewDocument(COMPANY_ID, DISABLED_ID, createDeps());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(CURRENCY_DISABLED_FOR_NEW_SELECTION);
    }
  });

  it("validateCurrencyForNewDocument rejects a company-disabled active currency", async () => {
    const result = await validateCurrencyForNewDocument(COMPANY_ID, AED_ID, createDeps());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(CURRENCY_NOT_ENABLED_FOR_COMPANY);
    }
  });

  it("validateCurrencyForNewDocument accepts an active company-enabled currency", async () => {
    const result = await validateCurrencyForNewDocument(COMPANY_ID, USD_ID, createDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok");
    }
    expect(result.data.code).toBe("USD");
  });

  it("listCurrenciesForNewDocument omits disabled and non-enabled currencies", async () => {
    const result = await listCurrenciesForNewDocument(COMPANY_ID, createDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok");
    }
    expect(result.data.map((row) => row.code)).toEqual(["USD", "GBP"]);
  });

  it("resolveCurrencyForHistoricalDisplay returns disabled catalog metadata unchanged", async () => {
    const result = await resolveCurrencyForHistoricalDisplay("XXX", createDeps());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok");
    }
    expect(result.data.code).toBe("XXX");
    expect(result.data.status).toBe("INACTIVE");
    expect(result.data.label).toContain("[disabled]");
  });
});
