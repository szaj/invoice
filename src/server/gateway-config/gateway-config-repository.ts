import "server-only";

import { Prisma } from "@/generated/prisma/client";

import type {
  CompanyGatewayConfiguration,
  GatewayEnvironment,
  GatewayMethodSafeView,
} from "@/domain/gateway-config/types";
import { deriveGatewayConfigStatus } from "@/domain/gateway-config/types";
import type { EncryptedCredentialRecord } from "@/server/gateway-credentials/gateway-credential-service";
import { createPaymentProviderRegistry } from "@/server/payments/providers/create-payment-provider-registry";
import { PAYMENT_METHOD_CODES, type PaymentMethodCode } from "@/domain/settlement/types";
import { getPrisma } from "@/server/db/client";

function isCredentialsConfigured(row: {
  credentialsCiphertext: Buffer | Uint8Array | null;
  credentialsNonce: Buffer | Uint8Array | null;
  credentialsAuthTag: Buffer | Uint8Array | null;
  wrappedDek: Buffer | Uint8Array | null;
  dekWrapNonce: Buffer | Uint8Array | null;
  dekWrapAuthTag: Buffer | Uint8Array | null;
  kekKeyVersion: number | null;
  encryptionFormatVersion: number | null;
}): boolean {
  return (
    row.credentialsCiphertext != null &&
    row.credentialsNonce != null &&
    row.credentialsAuthTag != null &&
    row.wrappedDek != null &&
    row.dekWrapNonce != null &&
    row.dekWrapAuthTag != null &&
    row.kekKeyVersion != null &&
    row.encryptionFormatVersion != null
  );
}

function toProviderConfig(
  value: Prisma.JsonValue | null | undefined,
): Readonly<Record<string, unknown>> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Readonly<Record<string, unknown>>;
}

function toBuffer(value: Buffer | Uint8Array | null): Buffer | null {
  if (value == null) {
    return null;
  }
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

/** Prisma Bytes fields expect Uint8Array backed by ArrayBuffer. */
function toPrismaBytes(value: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

export type GatewayConfigRow = {
  readonly id: string;
  readonly companyId: string;
  readonly methodCode: PaymentMethodCode;
  readonly enabled: boolean;
  readonly environment: GatewayEnvironment | null;
  readonly providerConfig: Readonly<Record<string, unknown>> | null;
  readonly credentialsConfigured: boolean;
  readonly envelope: EncryptedCredentialRecord | null;
  readonly enabledSettlementCurrencyCodes: readonly string[];
};

export class PrismaGatewayConfigStore {
  async companyExists(companyId: string): Promise<boolean> {
    const prisma = getPrisma();
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    return Boolean(company);
  }

  async getCompanyGatewayConfiguration(
    companyId: string,
  ): Promise<CompanyGatewayConfiguration | null> {
    const prisma = getPrisma();
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, displayName: true },
    });
    if (!company) {
      return null;
    }

    const configs = await prisma.paymentGatewayConfig.findMany({
      where: { companyId },
      include: { settlementCurrencies: true },
    });

    const registry = createPaymentProviderRegistry();
    const configByMethod = new Map(configs.map((row) => [row.methodCode, row] as const));

    const methods: GatewayMethodSafeView[] = PAYMENT_METHOD_CODES.map((methodCode) => {
      const row = configByMethod.get(methodCode);
      const credentialsConfigured = row ? isCredentialsConfigured(row) : false;
      const environment = (row?.environment ?? null) as GatewayEnvironment | null;
      const methodEnabled = row?.enabled === true;
      const enabledSettlementCurrencyCodes = (row?.settlementCurrencies ?? [])
        .filter((currency) => currency.enabled)
        .map((currency) => currency.currencyCode);

      return {
        methodCode,
        methodEnabled,
        environment,
        credentialsConfigured,
        providerConfig: toProviderConfig(row?.providerConfig),
        enabledSettlementCurrencyCodes,
        status: deriveGatewayConfigStatus({
          methodEnabled,
          methodCode,
          credentialsConfigured,
          environment,
        }),
        providerRegistered: registry.get(methodCode) != null,
      };
    });

    return {
      companyId: company.id,
      companyDisplayName: company.displayName,
      methods,
    };
  }

  async getMethodRow(
    companyId: string,
    methodCode: PaymentMethodCode,
  ): Promise<GatewayConfigRow | null> {
    const prisma = getPrisma();
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      return null;
    }

    const row = await prisma.paymentGatewayConfig.findUnique({
      where: { companyId_methodCode: { companyId, methodCode } },
      include: { settlementCurrencies: true },
    });

    if (!row) {
      return {
        id: "",
        companyId,
        methodCode,
        enabled: false,
        environment: null,
        providerConfig: null,
        credentialsConfigured: false,
        envelope: null,
        enabledSettlementCurrencyCodes: [],
      };
    }

    const credentialsConfigured = isCredentialsConfigured(row);
    const envelope =
      credentialsConfigured &&
      row.credentialsCiphertext &&
      row.credentialsNonce &&
      row.credentialsAuthTag &&
      row.wrappedDek &&
      row.dekWrapNonce &&
      row.dekWrapAuthTag &&
      row.kekKeyVersion != null &&
      row.encryptionFormatVersion != null
        ? {
            credentialsCiphertext: toBuffer(row.credentialsCiphertext)!,
            credentialsNonce: toBuffer(row.credentialsNonce)!,
            credentialsAuthTag: toBuffer(row.credentialsAuthTag)!,
            wrappedDek: toBuffer(row.wrappedDek)!,
            dekWrapNonce: toBuffer(row.dekWrapNonce)!,
            dekWrapAuthTag: toBuffer(row.dekWrapAuthTag)!,
            kekKeyVersion: row.kekKeyVersion,
            encryptionFormatVersion: row.encryptionFormatVersion,
          }
        : null;

    return {
      id: row.id,
      companyId: row.companyId,
      methodCode: row.methodCode,
      enabled: row.enabled,
      environment: row.environment,
      providerConfig: toProviderConfig(row.providerConfig),
      credentialsConfigured,
      envelope,
      enabledSettlementCurrencyCodes: row.settlementCurrencies
        .filter((currency) => currency.enabled)
        .map((currency) => currency.currencyCode),
    };
  }

  async updateNonSecretConfig(
    companyId: string,
    methodCode: PaymentMethodCode,
    input: {
      readonly methodEnabled?: boolean;
      readonly environment?: GatewayEnvironment | null;
      readonly providerConfig?: Readonly<Record<string, unknown>> | null;
    },
  ): Promise<CompanyGatewayConfiguration> {
    const prisma = getPrisma();

    await prisma.$transaction(async (tx) => {
      const existing = await tx.paymentGatewayConfig.findUnique({
        where: { companyId_methodCode: { companyId, methodCode } },
      });

      const data: Prisma.PaymentGatewayConfigUpdateInput = {};
      if (input.methodEnabled !== undefined) {
        data.enabled = input.methodEnabled;
      }
      if (input.environment !== undefined) {
        data.environment = input.environment;
      }
      if (input.providerConfig !== undefined) {
        data.providerConfig =
          input.providerConfig === null
            ? Prisma.DbNull
            : (input.providerConfig as Prisma.InputJsonValue);
      }

      if (existing) {
        // Non-secret update must not touch credential envelope columns.
        await tx.paymentGatewayConfig.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await tx.paymentGatewayConfig.create({
          data: {
            companyId,
            methodCode,
            enabled: input.methodEnabled ?? false,
            environment: input.environment ?? null,
            providerConfig:
              input.providerConfig === undefined
                ? undefined
                : input.providerConfig === null
                  ? Prisma.DbNull
                  : (input.providerConfig as Prisma.InputJsonValue),
          },
        });
      }
    });

    const refreshed = await this.getCompanyGatewayConfiguration(companyId);
    if (!refreshed) {
      throw new Error("GATEWAY_CONFIG_MISSING");
    }
    return refreshed;
  }

  async replaceCredentials(
    companyId: string,
    methodCode: PaymentMethodCode,
    envelope: EncryptedCredentialRecord,
  ): Promise<CompanyGatewayConfiguration> {
    const prisma = getPrisma();

    await prisma.paymentGatewayConfig.upsert({
      where: { companyId_methodCode: { companyId, methodCode } },
      create: {
        companyId,
        methodCode,
        enabled: false,
        credentialsCiphertext: toPrismaBytes(envelope.credentialsCiphertext),
        credentialsNonce: toPrismaBytes(envelope.credentialsNonce),
        credentialsAuthTag: toPrismaBytes(envelope.credentialsAuthTag),
        wrappedDek: toPrismaBytes(envelope.wrappedDek),
        dekWrapNonce: toPrismaBytes(envelope.dekWrapNonce),
        dekWrapAuthTag: toPrismaBytes(envelope.dekWrapAuthTag),
        kekKeyVersion: envelope.kekKeyVersion,
        encryptionFormatVersion: envelope.encryptionFormatVersion,
      },
      update: {
        credentialsCiphertext: toPrismaBytes(envelope.credentialsCiphertext),
        credentialsNonce: toPrismaBytes(envelope.credentialsNonce),
        credentialsAuthTag: toPrismaBytes(envelope.credentialsAuthTag),
        wrappedDek: toPrismaBytes(envelope.wrappedDek),
        dekWrapNonce: toPrismaBytes(envelope.dekWrapNonce),
        dekWrapAuthTag: toPrismaBytes(envelope.dekWrapAuthTag),
        kekKeyVersion: envelope.kekKeyVersion,
        encryptionFormatVersion: envelope.encryptionFormatVersion,
      },
    });

    const refreshed = await this.getCompanyGatewayConfiguration(companyId);
    if (!refreshed) {
      throw new Error("GATEWAY_CONFIG_MISSING");
    }
    return refreshed;
  }
}
