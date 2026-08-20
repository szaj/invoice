import { describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import { assertSettlementCurrencyEnabled } from "@/domain/settlement/assert-enabled";
import { paymentMethodSettlementWriteSchema } from "@/domain/settlement/schema";
import {
  SETTLEMENT_CURRENCY_INACTIVE_GLOBAL,
  SETTLEMENT_CURRENCY_NOT_ENABLED,
  type CompanySettlementConfiguration,
  type PaymentMethodSettlementConfig,
} from "@/domain/settlement/types";
import {
  getCompanySettlementConfiguration,
  updatePaymentMethodSettlementConfiguration,
  validateSettlementCurrencyForMethod,
  type SettlementDependencies,
} from "@/server/settlement/settlement-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

function principal(roleCode: RoleCode | null): AuthorizationPrincipal {
  return {
    userId: "actor-1",
    status: "ACTIVE",
    roleCode,
  };
}

function methodConfig(
  overrides: Partial<PaymentMethodSettlementConfig> = {},
): PaymentMethodSettlementConfig {
  return {
    methodCode: "STRIPE",
    methodEnabled: true,
    settlementCurrencies: [
      {
        currencyCode: "USD",
        name: "US Dollar",
        globalStatus: "ACTIVE",
        enabled: true,
        isInitial: true,
      },
      {
        currencyCode: "AED",
        name: "UAE Dirham",
        globalStatus: "ACTIVE",
        enabled: false,
        isInitial: true,
      },
      {
        currencyCode: "GBP",
        name: "Pound Sterling",
        globalStatus: "ACTIVE",
        enabled: false,
        isInitial: false,
      },
      {
        currencyCode: "XXX",
        name: "Inactive",
        globalStatus: "INACTIVE",
        enabled: false,
        isInitial: false,
      },
    ],
    enabledSettlementCurrencyCodes: ["USD"],
    ...overrides,
  };
}

function baseConfig(): CompanySettlementConfiguration {
  return {
    companyId: COMPANY_ID,
    companyDisplayName: "Virtue Xolutions",
    methods: [
      methodConfig(),
      methodConfig({
        methodCode: "PAYPAL",
        methodEnabled: false,
        enabledSettlementCurrencyCodes: [],
        settlementCurrencies: methodConfig().settlementCurrencies.map((currency) => ({
          ...currency,
          enabled: false,
        })),
      }),
      methodConfig({
        methodCode: "BANK_PROCESSOR",
        methodEnabled: false,
        enabledSettlementCurrencyCodes: [],
        settlementCurrencies: methodConfig().settlementCurrencies.map((currency) => ({
          ...currency,
          enabled: false,
        })),
      }),
      methodConfig({
        methodCode: "MANUAL",
        methodEnabled: false,
        enabledSettlementCurrencyCodes: [],
        settlementCurrencies: methodConfig().settlementCurrencies.map((currency) => ({
          ...currency,
          enabled: false,
        })),
      }),
    ],
  };
}

function createDeps(
  initial: CompanySettlementConfiguration = baseConfig(),
): SettlementDependencies & {
  store: SettlementDependencies["store"] & { current: CompanySettlementConfiguration };
} {
  const state = { current: initial };
  const store = {
    get current() {
      return state.current;
    },
    async companyExists() {
      return true;
    },
    async getCompanySettlementConfiguration() {
      return state.current;
    },
    async findActiveCurrencyCodes(codes: readonly string[]) {
      const active = new Set(
        state.current.methods[0]!.settlementCurrencies.filter(
          (currency) => currency.globalStatus === "ACTIVE",
        ).map((currency) => currency.currencyCode),
      );
      return codes.filter((code) => active.has(code));
    },
    async replaceMethodSettlementConfig(
      _companyId: string,
      methodCode: PaymentMethodSettlementConfig["methodCode"],
      input: { methodEnabled: boolean; enabledSettlementCurrencyCodes: readonly string[] },
    ) {
      state.current = {
        ...state.current,
        methods: state.current.methods.map((method) => {
          if (method.methodCode !== methodCode) {
            return method;
          }
          return {
            ...method,
            methodEnabled: input.methodEnabled,
            enabledSettlementCurrencyCodes: [...input.enabledSettlementCurrencyCodes],
            settlementCurrencies: method.settlementCurrencies.map((currency) => ({
              ...currency,
              enabled: input.enabledSettlementCurrencyCodes.includes(currency.currencyCode),
            })),
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

describe("settlement currency schema", () => {
  it("accepts method enablement and currency codes", () => {
    expect(
      paymentMethodSettlementWriteSchema.safeParse({
        methodEnabled: true,
        enabledSettlementCurrencyCodes: ["usd", "AED"],
      }).success,
    ).toBe(true);
  });
});

describe("assertSettlementCurrencyEnabled", () => {
  it("rejects when method disabled or currency not enabled", () => {
    expect(assertSettlementCurrencyEnabled(methodConfig(), "USD").ok).toBe(true);
    expect(assertSettlementCurrencyEnabled(methodConfig(), "AED").ok).toBe(false);
    expect(
      assertSettlementCurrencyEnabled(
        methodConfig({ methodEnabled: false, enabledSettlementCurrencyCodes: ["USD"] }),
        "USD",
      ).ok,
    ).toBe(false);
  });
});

describe("settlement currency authorization and rules", () => {
  it("allows Admin read and denies Staff mutate", async () => {
    const deps = createDeps();
    const read = await getCompanySettlementConfiguration(principal("ADMIN"), COMPANY_ID, deps);
    expect(read.ok).toBe(true);

    const denied = await updatePaymentMethodSettlementConfiguration(
      principal("STAFF"),
      COMPANY_ID,
      "STRIPE",
      { methodEnabled: true, enabledSettlementCurrencyCodes: ["USD", "AED"] },
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
    const result = await updatePaymentMethodSettlementConfiguration(
      principal("ADMIN"),
      COMPANY_ID,
      "STRIPE",
      { methodEnabled: true, enabledSettlementCurrencyCodes: ["XXX"] },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(SETTLEMENT_CURRENCY_INACTIVE_GLOBAL);
    }
  });

  it("rejects a non-enabled settlement currency (BR-006)", async () => {
    const deps = createDeps();
    const result = await validateSettlementCurrencyForMethod(
      principal("ADMIN"),
      COMPANY_ID,
      "STRIPE",
      "GBP",
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe(SETTLEMENT_CURRENCY_NOT_ENABLED);
    }
  });

  it("persists enabled settlement currencies and audits", async () => {
    const auditWriter = createMemoryAuditWriter();
    const deps = { ...createDeps(), auditWriter };
    const result = await updatePaymentMethodSettlementConfiguration(
      principal("ADMIN"),
      COMPANY_ID,
      "STRIPE",
      { methodEnabled: true, enabledSettlementCurrencyCodes: ["USD", "AED"] },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("update failed");
    }
    const stripe = result.data.methods.find((method) => method.methodCode === "STRIPE");
    expect(stripe?.enabledSettlementCurrencyCodes).toEqual(["USD", "AED"]);
    expect(auditWriter.events).toHaveLength(1);
  });
});
