import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import { companyCurrencyConfigWriteSchema } from "@/domain/companies/company-currency-schema";
import {
  COMPANY_CURRENCY_INACTIVE_GLOBAL,
  type CompanyCurrencyConfiguration,
} from "@/domain/companies/company-currency-types";
import {
  getCompanyCurrencyConfiguration,
  updateCompanyCurrencyConfiguration,
  type CompanyCurrencyDependencies,
} from "@/server/companies/company-currency-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USD_ID = "dddddddd-dddd-4ddd-8ddd-000000000001";
const AED_ID = "dddddddd-dddd-4ddd-8ddd-000000000002";
const INACTIVE_ID = "dddddddd-dddd-4ddd-8ddd-000000000099";

function principal(roleCode: RoleCode | null): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
  };
}

function baseConfig(
  overrides: Partial<CompanyCurrencyConfiguration> = {},
): CompanyCurrencyConfiguration {
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
        enabled: false,
        isDefault: false,
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
        currencyId: INACTIVE_ID,
        code: "XXX",
        name: "Inactive",
        symbol: "X",
        decimalPrecision: 2,
        globalStatus: "INACTIVE",
        enabled: false,
        isDefault: false,
      },
    ],
    enabledCurrencyIds: [],
    defaultCurrencyId: null,
    ...overrides,
  };
}

function createDeps(
  initial: CompanyCurrencyConfiguration = baseConfig(),
): CompanyCurrencyDependencies & {
  store: CompanyCurrencyDependencies["store"] & {
    current: CompanyCurrencyConfiguration;
  };
} {
  const state = { current: initial };
  const store = {
    get current() {
      return state.current;
    },
    async companyExists() {
      return true;
    },
    async getCompanyCurrencyConfiguration() {
      return state.current;
    },
    async findActiveCurrenciesByIds(currencyIds: readonly string[]) {
      return currencyIds
        .map((id) => state.current.currencies.find((currency) => currency.currencyId === id))
        .filter((currency): currency is NonNullable<typeof currency> => Boolean(currency))
        .filter((currency) => currency.globalStatus === "ACTIVE")
        .map((currency) => ({
          id: currency.currencyId,
          code: currency.code,
          status: currency.globalStatus,
        }));
    },
    async replaceCompanyCurrencies(
      _companyId: string,
      input: { enabledCurrencyIds: readonly string[]; defaultCurrencyId: string | null },
    ) {
      const preservedInactiveIds = state.current.currencies
        .filter((currency) => currency.globalStatus === "INACTIVE" && currency.enabled)
        .map((currency) => currency.currencyId);
      const mergedEnabled = [
        ...input.enabledCurrencyIds,
        ...preservedInactiveIds.filter((id) => !input.enabledCurrencyIds.includes(id)),
      ];
      state.current = {
        ...state.current,
        enabledCurrencyIds: mergedEnabled,
        defaultCurrencyId: input.defaultCurrencyId,
        currencies: state.current.currencies.map((currency) => {
          const preservedInactive =
            currency.globalStatus === "INACTIVE" &&
            preservedInactiveIds.includes(currency.currencyId);
          const enabled =
            input.enabledCurrencyIds.includes(currency.currencyId) || preservedInactive;
          return {
            ...currency,
            enabled,
            isDefault: preservedInactive ? false : currency.currencyId === input.defaultCurrencyId,
          };
        }),
      };
      return state.current;
    },
  };

  return {
    store,
    auditWriter: createMemoryAuditWriter(),
  };
}

describe("company currency schema", () => {
  it("requires default to be one of the enabled currencies", () => {
    expect(
      companyCurrencyConfigWriteSchema.safeParse({
        enabledCurrencyIds: [USD_ID],
        defaultCurrencyId: AED_ID,
      }).success,
    ).toBe(false);
    expect(
      companyCurrencyConfigWriteSchema.safeParse({
        enabledCurrencyIds: [USD_ID, AED_ID],
        defaultCurrencyId: USD_ID,
      }).success,
    ).toBe(true);
  });
});

describe("company currency authorization and rules", () => {
  it("allows Admin read and denies Staff mutate", async () => {
    const deps = createDeps();
    const read = await getCompanyCurrencyConfiguration(principal("ADMIN"), COMPANY_ID, deps);
    expect(read.ok).toBe(true);

    const denied = await updateCompanyCurrencyConfiguration(
      principal("STAFF"),
      COMPANY_ID,
      { enabledCurrencyIds: [USD_ID], defaultCurrencyId: USD_ID },
      deps,
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe(GENERIC_FORBIDDEN);
    }
  });

  it("rejects enabling a globally inactive currency", async () => {
    const deps = createDeps();
    const result = await updateCompanyCurrencyConfiguration(
      principal("ADMIN"),
      COMPANY_ID,
      { enabledCurrencyIds: [INACTIVE_ID], defaultCurrencyId: INACTIVE_ID },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(COMPANY_CURRENCY_INACTIVE_GLOBAL);
    }
  });

  it("preserves historically enabled inactive currencies when saving active subset", async () => {
    const deps = createDeps(
      baseConfig({
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
            currencyId: INACTIVE_ID,
            code: "XXX",
            name: "Inactive",
            symbol: "X",
            decimalPrecision: 2,
            globalStatus: "INACTIVE",
            enabled: true,
            isDefault: false,
          },
        ],
        enabledCurrencyIds: [USD_ID, INACTIVE_ID],
        defaultCurrencyId: USD_ID,
      }),
    );

    const result = await updateCompanyCurrencyConfiguration(
      principal("ADMIN"),
      COMPANY_ID,
      { enabledCurrencyIds: [USD_ID, AED_ID], defaultCurrencyId: AED_ID },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("update failed");
    }
    expect(result.data.enabledCurrencyIds).toEqual(
      expect.arrayContaining([USD_ID, AED_ID, INACTIVE_ID]),
    );
    expect(
      result.data.currencies.find((currency) => currency.currencyId === INACTIVE_ID)?.enabled,
    ).toBe(true);
    expect(result.data.defaultCurrencyId).toBe(AED_ID);
  });

  it("persists an enabled subset with default and audits the change", async () => {
    const auditWriter = createMemoryAuditWriter();
    const deps = { ...createDeps(), auditWriter };
    const result = await updateCompanyCurrencyConfiguration(
      principal("ADMIN"),
      COMPANY_ID,
      { enabledCurrencyIds: [USD_ID, AED_ID], defaultCurrencyId: AED_ID },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("update failed");
    }
    expect(result.data.enabledCurrencyIds).toEqual([USD_ID, AED_ID]);
    expect(result.data.defaultCurrencyId).toBe(AED_ID);
    expect(auditWriter.events).toHaveLength(1);
    expect(auditWriter.events[0]?.action).toBe("companies.currencies_updated");
  });
});
