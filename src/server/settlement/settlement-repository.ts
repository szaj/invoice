import "server-only";

import type {
  CompanySettlementConfiguration,
  PaymentMethodCode,
  PaymentMethodSettlementConfig,
  SettlementCurrencyFlag,
} from "@/domain/settlement/types";
import { INITIAL_SETTLEMENT_CURRENCY_CODES, PAYMENT_METHOD_CODES } from "@/domain/settlement/types";
import { getPrisma } from "@/server/db/client";

function isInitial(code: string): boolean {
  return (INITIAL_SETTLEMENT_CURRENCY_CODES as readonly string[]).includes(code);
}

export class PrismaSettlementConfigStore {
  async companyExists(companyId: string): Promise<boolean> {
    const prisma = getPrisma();
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    return Boolean(company);
  }

  async getCompanySettlementConfiguration(
    companyId: string,
  ): Promise<CompanySettlementConfiguration | null> {
    const prisma = getPrisma();
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, displayName: true },
    });
    if (!company) {
      return null;
    }

    const [currencies, configs] = await Promise.all([
      prisma.currency.findMany({ orderBy: { code: "asc" } }),
      prisma.paymentGatewayConfig.findMany({
        where: { companyId },
        include: { settlementCurrencies: true },
      }),
    ]);

    const configByMethod = new Map(configs.map((row) => [row.methodCode, row] as const));

    const methods: PaymentMethodSettlementConfig[] = PAYMENT_METHOD_CODES.map((methodCode) => {
      const config = configByMethod.get(methodCode);
      const enabledCodes = new Set(
        (config?.settlementCurrencies ?? [])
          .filter((row) => row.enabled)
          .map((row) => row.currencyCode),
      );

      const settlementCurrencies: SettlementCurrencyFlag[] = currencies.map((currency) => ({
        currencyCode: currency.code,
        name: currency.name,
        globalStatus: currency.status,
        enabled: enabledCodes.has(currency.code),
        isInitial: isInitial(currency.code),
      }));

      return {
        methodCode,
        methodEnabled: config?.enabled === true,
        settlementCurrencies,
        enabledSettlementCurrencyCodes: settlementCurrencies
          .filter((currency) => currency.enabled)
          .map((currency) => currency.currencyCode),
      };
    });

    return {
      companyId: company.id,
      companyDisplayName: company.displayName,
      methods,
    };
  }

  async findActiveCurrencyCodes(codes: readonly string[]): Promise<string[]> {
    if (codes.length === 0) {
      return [];
    }
    const prisma = getPrisma();
    const rows = await prisma.currency.findMany({
      where: { code: { in: [...codes] }, status: "ACTIVE" },
      select: { code: true },
    });
    return rows.map((row) => row.code);
  }

  async replaceMethodSettlementConfig(
    companyId: string,
    methodCode: PaymentMethodCode,
    input: { methodEnabled: boolean; enabledSettlementCurrencyCodes: readonly string[] },
  ): Promise<CompanySettlementConfiguration> {
    const prisma = getPrisma();

    await prisma.$transaction(async (tx) => {
      const config = await tx.paymentGatewayConfig.upsert({
        where: {
          companyId_methodCode: { companyId, methodCode },
        },
        create: {
          companyId,
          methodCode,
          enabled: input.methodEnabled,
        },
        update: {
          enabled: input.methodEnabled,
        },
      });

      await tx.paymentGatewaySettlementCurrency.deleteMany({
        where: { gatewayConfigId: config.id },
      });

      if (input.enabledSettlementCurrencyCodes.length > 0) {
        await tx.paymentGatewaySettlementCurrency.createMany({
          data: input.enabledSettlementCurrencyCodes.map((currencyCode) => ({
            gatewayConfigId: config.id,
            currencyCode,
            enabled: true,
          })),
        });
      }
    });

    const refreshed = await this.getCompanySettlementConfiguration(companyId);
    if (!refreshed) {
      throw new Error("SETTLEMENT_CONFIG_MISSING");
    }
    return refreshed;
  }
}
