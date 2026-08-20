import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { RoleCode } from "@/domain/authz/roles";
import {
  fixedConversionRateCreateSchema,
  fixedRateDecimalSchema,
} from "@/domain/fixed-rates/schema";
import type { FixedConversionRateRecord } from "@/domain/fixed-rates/types";
import type { CreateFixedRateInput } from "@/server/fixed-rates/fixed-rate-repository";
import {
  createFixedConversionRate,
  listFixedConversionRates,
  type FixedRateDependencies,
} from "@/server/fixed-rates/fixed-rate-service";
import { createMemoryAuditWriter } from "../helpers/memory-audit-writer";

function principal(roleCode: RoleCode | null): AuthorizationPrincipal {
  return {
    userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee30",
    status: "ACTIVE",
    roleCode,
  };
}

function createDeps(currencyCodes: string[] = ["USD", "AED", "GBP"]): FixedRateDependencies & {
  store: { rates: FixedConversionRateRecord[] };
} {
  const rates: FixedConversionRateRecord[] = [];
  const store = {
    rates,
    async findCurrencyCodes(codes: readonly string[]) {
      return codes.filter((code) => currencyCodes.includes(code));
    },
    async nextVersionNo(fromCurrency: string, toCurrency: string) {
      const max = rates
        .filter((rate) => rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency)
        .reduce((current, rate) => Math.max(current, rate.versionNo), 0);
      return max + 1;
    },
    async listRates(filter?: { fromCurrency?: string; toCurrency?: string }) {
      return rates
        .filter((rate) => (filter?.fromCurrency ? rate.fromCurrency === filter.fromCurrency : true))
        .filter((rate) => (filter?.toCurrency ? rate.toCurrency === filter.toCurrency : true))
        .slice()
        .sort((a, b) => {
          const pair = `${a.fromCurrency}${a.toCurrency}`.localeCompare(
            `${b.fromCurrency}${b.toCurrency}`,
          );
          return pair !== 0 ? pair : b.versionNo - a.versionNo;
        });
    },
    async createVersionAndExpirePrevious(input: CreateFixedRateInput) {
      const expired: FixedConversionRateRecord[] = [];
      for (let index = 0; index < rates.length; index += 1) {
        const prior = rates[index]!;
        if (
          prior.fromCurrency === input.fromCurrency &&
          prior.toCurrency === input.toCurrency &&
          prior.status === "ACTIVE"
        ) {
          const closedValidTo =
            prior.validTo && prior.validTo.getTime() <= input.validFrom.getTime()
              ? prior.validTo
              : input.validFrom;
          const updated: FixedConversionRateRecord = {
            ...prior,
            status: "EXPIRED",
            validTo: closedValidTo,
          };
          rates[index] = updated;
          expired.push(updated);
        }
      }

      const created: FixedConversionRateRecord = {
        id: `rate-${rates.length + 1}`,
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        fixedRate: new Prisma.Decimal(input.fixedRate).toFixed(12),
        versionNo: input.versionNo,
        frequencyLabel: input.frequencyLabel,
        validFrom: input.validFrom,
        validTo: input.validTo,
        status: "ACTIVE",
        notes: input.notes,
        createdByUserId: input.createdByUserId,
        createdAt: new Date("2026-08-20T12:00:00.000Z"),
      };
      rates.push(created);
      return { created, expired };
    },
  };

  return {
    store,
    auditWriter: createMemoryAuditWriter(),
    now: () => new Date("2026-06-15T00:00:00.000Z"),
  };
}

describe("fixed rate decimal precision", () => {
  it("accepts up to 12 decimal places via Decimal string and rejects float-style junk", () => {
    expect(fixedRateDecimalSchema.safeParse("3.670000000000").success).toBe(true);
    expect(fixedRateDecimalSchema.safeParse("3.68000001").success).toBe(true);
    expect(fixedRateDecimalSchema.safeParse("1.123456789012").success).toBe(true);
    expect(fixedRateDecimalSchema.safeParse("1.1234567890123").success).toBe(false);
    expect(fixedRateDecimalSchema.safeParse("0").success).toBe(false);
    expect(fixedRateDecimalSchema.safeParse("0.0").success).toBe(false);

    const stored = new Prisma.Decimal("3.670000000001");
    expect(stored.toFixed()).toBe("3.670000000001");
    expect(stored.equals(new Prisma.Decimal("3.670000000001"))).toBe(true);
  });

  it("requires distinct from/to currencies and valid date order", () => {
    expect(
      fixedConversionRateCreateSchema.safeParse({
        fromCurrency: "USD",
        toCurrency: "USD",
        fixedRate: "1.00000000",
        frequencyLabel: "MANUAL",
        validFrom: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(false);

    expect(
      fixedConversionRateCreateSchema.safeParse({
        fromCurrency: "USD",
        toCurrency: "AED",
        fixedRate: "3.670000000000",
        frequencyLabel: "YEARLY",
        validFrom: "2026-01-01T00:00:00.000Z",
        validTo: "2025-12-31T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("fixed conversion rate versioning", () => {
  it("denies Non-Admin create", async () => {
    const denied = await createFixedConversionRate(
      principal("STAFF"),
      {
        fromCurrency: "USD",
        toCurrency: "AED",
        fixedRate: "3.670000000000",
        frequencyLabel: "YEARLY",
        validFrom: "2026-01-01T00:00:00.000Z",
      },
      createDeps(),
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe(GENERIC_FORBIDDEN);
    }
  });

  it("expires previous ACTIVE version on create and retains history", async () => {
    const auditWriter = createMemoryAuditWriter();
    const deps = { ...createDeps(), auditWriter };

    const first = await createFixedConversionRate(
      principal("ADMIN"),
      {
        fromCurrency: "USD",
        toCurrency: "AED",
        fixedRate: "3.670000000000",
        frequencyLabel: "YEARLY",
        validFrom: "2026-01-01T00:00:00.000Z",
        notes: "v1",
      },
      deps,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error("first create failed");
    }
    expect(first.data.versionNo).toBe(1);
    expect(first.data.status).toBe("ACTIVE");

    const second = await createFixedConversionRate(
      principal("ADMIN"),
      {
        fromCurrency: "USD",
        toCurrency: "AED",
        fixedRate: "3.680000000000",
        frequencyLabel: "MONTHLY",
        validFrom: "2026-07-01T00:00:00.000Z",
        notes: "v2",
      },
      deps,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error("second create failed");
    }
    expect(second.data.versionNo).toBe(2);
    expect(second.data.status).toBe("ACTIVE");
    expect(second.data.fixedRate).toBe("3.680000000000");

    const history = await listFixedConversionRates(
      principal("ADMIN"),
      { fromCurrency: "USD", toCurrency: "AED" },
      deps,
    );
    expect(history.ok).toBe(true);
    if (!history.ok) {
      throw new Error("list failed");
    }
    expect(history.data).toHaveLength(2);
    expect(history.data[0]?.versionNo).toBe(2);
    expect(history.data[0]?.status).toBe("ACTIVE");
    expect(history.data[1]?.versionNo).toBe(1);
    expect(history.data[1]?.status).toBe("EXPIRED");
    expect(history.data[1]?.validTo?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    // Historical rate amount is retained (not edited in place).
    expect(history.data[1]?.fixedRate).toBe("3.670000000000");

    const actions = auditWriter.events.map((event) => event.action);
    expect(actions).toContain("fixed_rates.created");
    expect(actions).toContain("fixed_rates.activated");
    expect(actions).toContain("fixed_rates.expired");
    expect(actions).toContain("fixed_rates.superseded");
  });

  it("audits scheduled when validFrom is in the future", async () => {
    const auditWriter = createMemoryAuditWriter();
    const deps = {
      ...createDeps(),
      auditWriter,
      now: () => new Date("2026-06-15T00:00:00.000Z"),
    };
    const created = await createFixedConversionRate(
      principal("ADMIN"),
      {
        fromCurrency: "GBP",
        toCurrency: "USD",
        fixedRate: "1.250000000000",
        frequencyLabel: "MANUAL",
        validFrom: "2026-12-01T00:00:00.000Z",
      },
      deps,
    );
    expect(created.ok).toBe(true);
    const actions = auditWriter.events.map((event) => event.action);
    expect(actions).toEqual(["fixed_rates.created", "fixed_rates.scheduled"]);
  });
});
