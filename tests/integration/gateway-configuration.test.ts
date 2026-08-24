import { randomBytes } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { AuditActions } from "@/domain/audit/types";
import {
  getCompanyGatewayConfiguration,
  replaceGatewayMethodCredentials,
  toPaymentProviderGatewayConfig,
  updateGatewayMethodConfiguration,
} from "@/server/gateway-config/gateway-config-service";
import { PrismaGatewayConfigStore } from "@/server/gateway-config/gateway-config-repository";
import { GatewayCredentialService } from "@/server/gateway-credentials/gateway-credential-service";
import { updatePaymentMethodSettlementConfiguration } from "@/server/settlement/settlement-service";
import { PrismaSettlementConfigStore } from "@/server/settlement/settlement-repository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "true";

function testKek(): string {
  return randomBytes(32).toString("base64");
}

describe.skipIf(!runDbIntegration)("gateway configuration per company integration", () => {
  const createdCompanyIds: string[] = [];
  const createdAuditIds: string[] = [];
  const kek = testKek();
  const credentialService = GatewayCredentialService.fromEnv({
    GATEWAY_CREDENTIALS_KEY_VERSION: "1",
    GATEWAY_CREDENTIALS_KEY_V1: kek,
  });
  const deps = {
    store: new PrismaGatewayConfigStore(),
    credentialService,
  };

  afterAll(async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    if (createdAuditIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.paymentGatewayConfig.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
    }
  });

  it("records the gateway_configuration_credentials migration when applied", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE migration_name = '20260824270000_gateway_configuration_credentials'
    `;
    expect(rows).toHaveLength(1);
  });

  it("stores encrypted credentials, preserves them on non-secret PATCH, and never leaks secrets", async () => {
    const { getPrisma } = await import("@/server/db/client");
    const prisma = getPrisma();

    const admin: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee41",
      status: "ACTIVE",
      roleCode: "ADMIN",
    };
    const staff: AuthorizationPrincipal = {
      userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee42",
      status: "ACTIVE",
      roleCode: "STAFF",
    };

    const companyA = await prisma.company.create({
      data: {
        displayName: `Gateway Config A ${Date.now()}`,
        status: "ACTIVE",
      },
    });
    const companyB = await prisma.company.create({
      data: {
        displayName: `Gateway Config B ${Date.now()}`,
        status: "ACTIVE",
      },
    });
    createdCompanyIds.push(companyA.id, companyB.id);

    const staffDenied = await replaceGatewayMethodCredentials(
      staff,
      companyA.id,
      "STRIPE",
      { credentials: { apiKey: "sk_test_should_not_store" } },
      deps,
    );
    expect(staffDenied.ok).toBe(false);
    if (!staffDenied.ok) {
      expect(staffDenied.status).toBe(403);
      expect(staffDenied.error).toBe(GENERIC_FORBIDDEN);
    }

    const secretValue = `sk_test_${randomBytes(8).toString("hex")}`;
    const webhookSecret = `whsec_${randomBytes(8).toString("hex")}`;

    const replaced = await replaceGatewayMethodCredentials(
      admin,
      companyA.id,
      "STRIPE",
      { credentials: { apiKey: secretValue, webhookSecret } },
      deps,
    );
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      return;
    }

    const responseJson = JSON.stringify(replaced.data);
    expect(responseJson).toContain('"credentialsConfigured":true');
    expect(responseJson).not.toContain(secretValue);
    expect(responseJson).not.toContain(webhookSecret);
    expect(responseJson).not.toMatch(/ciphertext|wrappedDek|credentialsNonce|authTag|apiKey/i);

    const row = await prisma.paymentGatewayConfig.findUnique({
      where: {
        companyId_methodCode: { companyId: companyA.id, methodCode: "STRIPE" },
      },
    });
    expect(row).not.toBeNull();
    expect(row!.credentialsCiphertext).not.toBeNull();
    expect(row!.kekKeyVersion).toBe(1);
    expect(row!.encryptionFormatVersion).toBe(1);
    expect(Buffer.from(row!.credentialsCiphertext!).toString("utf8")).not.toContain(secretValue);

    const decrypted = credentialService.decryptCredentials(
      {
        credentialsCiphertext: Buffer.from(row!.credentialsCiphertext!),
        credentialsNonce: Buffer.from(row!.credentialsNonce!),
        credentialsAuthTag: Buffer.from(row!.credentialsAuthTag!),
        wrappedDek: Buffer.from(row!.wrappedDek!),
        dekWrapNonce: Buffer.from(row!.dekWrapNonce!),
        dekWrapAuthTag: Buffer.from(row!.dekWrapAuthTag!),
        kekKeyVersion: row!.kekKeyVersion!,
        encryptionFormatVersion: row!.encryptionFormatVersion!,
      },
      { companyId: companyA.id, methodCode: "STRIPE" },
    );
    expect(decrypted.apiKey).toBe(secretValue);

    // Company isolation: company B must not see company A credentials metadata as its own.
    const companyBView = await getCompanyGatewayConfiguration(admin, companyB.id, deps);
    expect(companyBView.ok).toBe(true);
    if (companyBView.ok) {
      const stripeB = companyBView.data.methods.find((method) => method.methodCode === "STRIPE");
      expect(stripeB?.credentialsConfigured).toBe(false);
    }

    const patched = await updateGatewayMethodConfiguration(
      admin,
      companyA.id,
      "STRIPE",
      {
        methodEnabled: true,
        environment: "SANDBOX",
        providerConfig: { webhookUrl: "https://example.com/stripe-hook" },
      },
      deps,
    );
    expect(patched.ok).toBe(true);
    if (!patched.ok) {
      return;
    }
    const stripe = patched.data.methods.find((method) => method.methodCode === "STRIPE");
    expect(stripe?.methodEnabled).toBe(true);
    expect(stripe?.environment).toBe("SANDBOX");
    expect(stripe?.credentialsConfigured).toBe(true);
    expect(stripe?.providerConfig).toEqual({ webhookUrl: "https://example.com/stripe-hook" });
    expect(stripe?.status).toBe("HEALTHY");
    expect(JSON.stringify(patched.data)).not.toContain(secretValue);

    const afterPatch = await prisma.paymentGatewayConfig.findUnique({
      where: {
        companyId_methodCode: { companyId: companyA.id, methodCode: "STRIPE" },
      },
    });
    expect(afterPatch!.kekKeyVersion).toBe(1);
    expect(
      Buffer.from(afterPatch!.credentialsCiphertext!).equals(
        Buffer.from(row!.credentialsCiphertext!),
      ),
    ).toBe(true);

    // Reuse TASK-020 settlement configuration rather than duplicating it.
    const settlementDeps = { store: new PrismaSettlementConfigStore() };
    const settlement = await updatePaymentMethodSettlementConfiguration(
      admin,
      companyA.id,
      "STRIPE",
      { methodEnabled: true, enabledSettlementCurrencyCodes: ["USD", "AED"] },
      settlementDeps,
    );
    expect(settlement.ok).toBe(true);

    const refreshed = await getCompanyGatewayConfiguration(admin, companyA.id, deps);
    expect(refreshed.ok).toBe(true);
    if (refreshed.ok) {
      const method = refreshed.data.methods.find((row) => row.methodCode === "STRIPE");
      expect(method).toBeDefined();
      expect([...(method?.enabledSettlementCurrencyCodes ?? [])].sort()).toEqual(["AED", "USD"]);
      expect(method?.credentialsConfigured).toBe(true);
    }

    const providerConfig = await toPaymentProviderGatewayConfig(companyA.id, "STRIPE", deps);
    expect(providerConfig).toEqual({
      companyId: companyA.id,
      methodCode: "STRIPE",
      enabled: true,
      environment: "SANDBOX",
      enabledSettlementCurrencyCodes: expect.arrayContaining(["USD", "AED"]),
      credentialsConfigured: true,
    });
    expect(JSON.stringify(providerConfig)).not.toContain(secretValue);

    const audits = await prisma.auditLog.findMany({
      where: {
        companyId: companyA.id,
        action: {
          in: [AuditActions.GATEWAY_CREDENTIALS_REPLACED, AuditActions.GATEWAY_CONFIG_UPDATED],
        },
      },
      orderBy: { occurredAt: "asc" },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
    createdAuditIds.push(...audits.map((audit) => audit.id));
    const auditJson = JSON.stringify(audits);
    expect(auditJson).not.toContain(secretValue);
    expect(auditJson).not.toContain(webhookSecret);
    expect(auditJson).not.toMatch(/ciphertext|wrappedDek|sk_test_/i);
    expect(auditJson).toContain("credentialsConfigured");
  }, 60_000);
});
