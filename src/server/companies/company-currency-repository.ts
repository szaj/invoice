import "server-only";

import type { CompanyCurrencyConfiguration } from "@/domain/companies/company-currency-types";
import { getPrisma } from "@/server/db/client";

export class PrismaCompanyCurrencyStore {
  async getCompanyCurrencyConfiguration(
    companyId: string,
  ): Promise<CompanyCurrencyConfiguration | null> {
    const prisma = getPrisma();
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, displayName: true },
    });
    if (!company) {
      return null;
    }

    const [globalCurrencies, assignments] = await Promise.all([
      prisma.currency.findMany({ orderBy: { code: "asc" } }),
      prisma.companyCurrency.findMany({ where: { companyId } }),
    ]);

    const assignmentByCurrencyId = new Map(
      assignments.map((row) => [row.currencyId, row] as const),
    );

    const currencies = globalCurrencies.map((currency) => {
      const assignment = assignmentByCurrencyId.get(currency.id);
      return {
        currencyId: currency.id,
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimalPrecision: currency.decimalPrecision,
        globalStatus: currency.status,
        enabled: assignment?.enabled === true,
        isDefault: assignment?.isDefault === true,
      };
    });

    const enabled = currencies.filter((currency) => currency.enabled);
    const defaultCurrency = enabled.find((currency) => currency.isDefault) ?? null;

    return {
      companyId: company.id,
      companyDisplayName: company.displayName,
      currencies,
      enabledCurrencyIds: enabled.map((currency) => currency.currencyId),
      defaultCurrencyId: defaultCurrency?.currencyId ?? null,
    };
  }

  async replaceCompanyCurrencies(
    companyId: string,
    input: {
      enabledCurrencyIds: readonly string[];
      defaultCurrencyId: string | null;
    },
  ): Promise<CompanyCurrencyConfiguration> {
    const prisma = getPrisma();

    await prisma.$transaction(async (tx) => {
      // BR-011: keep company assignments for globally INACTIVE currencies so they
      // remain visible as historical enablement; they are not selectable for new docs.
      const historicallyInactive = await tx.companyCurrency.findMany({
        where: {
          companyId,
          enabled: true,
          currency: { status: "INACTIVE" },
        },
        select: { currencyId: true },
      });
      const preservedInactiveIds = historicallyInactive.map((row) => row.currencyId);
      const preservedSet = new Set(preservedInactiveIds);

      await tx.companyCurrency.deleteMany({ where: { companyId } });

      const activeRows = input.enabledCurrencyIds
        .filter((currencyId) => !preservedSet.has(currencyId))
        .map((currencyId) => ({
          companyId,
          currencyId,
          enabled: true,
          isDefault: currencyId === input.defaultCurrencyId,
        }));

      const inactiveRows = preservedInactiveIds.map((currencyId) => ({
        companyId,
        currencyId,
        enabled: true,
        isDefault: false,
      }));

      const rows = [...activeRows, ...inactiveRows];
      if (rows.length === 0) {
        return;
      }

      await tx.companyCurrency.createMany({ data: rows });
    });

    const refreshed = await this.getCompanyCurrencyConfiguration(companyId);
    if (!refreshed) {
      throw new Error("COMPANY_CURRENCY_CONFIG_MISSING");
    }
    return refreshed;
  }

  async findActiveCurrenciesByIds(currencyIds: readonly string[]) {
    if (currencyIds.length === 0) {
      return [];
    }
    const prisma = getPrisma();
    return prisma.currency.findMany({
      where: {
        id: { in: [...currencyIds] },
        status: "ACTIVE",
      },
      select: { id: true, code: true, status: true },
    });
  }

  async companyExists(companyId: string): Promise<boolean> {
    const prisma = getPrisma();
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    return Boolean(company);
  }
}
