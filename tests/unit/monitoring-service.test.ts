import { describe, expect, it, vi } from "vitest";

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";
import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import type { CompanyGatewayConfiguration } from "@/domain/gateway-config/types";
import type { PaymentProvider } from "@/domain/payments/providers/types";
import { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import {
  getApplicationHealth,
  getOperationalMonitoringSnapshot,
} from "@/server/monitoring/monitoring-service";

function mockBackupSnapshot() {
  return {
    database: {
      status: "DISABLED" as const,
      configured: false,
      lastSuccessAt: null,
      lastArtifactName: null,
      retentionDays: 30,
      maxAgeHours: 26,
      pitrRecommended: false,
      managedProvider: "SUPABASE" as const,
    },
    objectStorage: {
      status: "DISABLED" as const,
      configured: false,
      provider: null,
      versioningEnabled: null,
      versioningRequired: false,
    },
  };
}

const admin: AuthorizationPrincipal = {
  userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee01",
  status: "ACTIVE",
  roleCode: "ADMIN",
};

const staff: AuthorizationPrincipal = {
  userId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee02",
  status: "ACTIVE",
  roleCode: "STAFF",
};

function stripeAdapter(): PaymentProvider {
  return {
    methodCode: "STRIPE",
    capabilities: {
      supportsHostedCheckout: true,
      supportsWebhooks: true,
      supportsRefunds: true,
      supportsPartialRefunds: true,
      supportsFeeRetrieval: false,
      supportsPaymentStatusLookup: true,
      supportsMultipleSettlementCurrencies: true,
      supportsHealthCheck: true,
    },
    createPaymentRequest: vi.fn(),
    getPaymentStatus: vi.fn(),
    verifyWebhook: vi.fn(),
    parseWebhook: vi.fn(),
    refundPayment: vi.fn(),
    getFees: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true, status: "HEALTHY" }),
  };
}

function gatewayConfiguration(companyId: string): CompanyGatewayConfiguration {
  return {
    companyId,
    companyDisplayName: "Acme",
    methods: [
      {
        methodCode: "STRIPE",
        methodEnabled: true,
        environment: "SANDBOX",
        credentialsConfigured: true,
        providerConfig: null,
        enabledSettlementCurrencyCodes: ["USD"],
        status: "HEALTHY",
        providerRegistered: true,
      },
      {
        methodCode: "PAYPAL",
        methodEnabled: false,
        environment: null,
        credentialsConfigured: false,
        providerConfig: null,
        enabledSettlementCurrencyCodes: [],
        status: "DISABLED",
        providerRegistered: true,
      },
      {
        methodCode: "MANUAL",
        methodEnabled: true,
        environment: null,
        credentialsConfigured: false,
        providerConfig: null,
        enabledSettlementCurrencyCodes: ["USD"],
        status: "HEALTHY",
        providerRegistered: true,
      },
      {
        methodCode: "BANK_PROCESSOR",
        methodEnabled: false,
        environment: null,
        credentialsConfigured: false,
        providerConfig: null,
        enabledSettlementCurrencyCodes: [],
        status: "DISABLED",
        providerRegistered: false,
      },
    ],
  };
}

describe("monitoring service (TASK-100)", () => {
  it("returns application health with database ping", async () => {
    const health = await getApplicationHealth({
      monitoringStore: {
        listActiveCompanies: vi.fn(),
        countRecentWebhookFailures: vi.fn(),
        pingDatabase: vi.fn().mockResolvedValue(true),
      },
    });

    expect(health.database).toBe(true);
    expect(health.status).toBe("HEALTHY");
  });

  it("denies operational snapshot to non-admin users", async () => {
    const result = await getOperationalMonitoringSnapshot(staff, {
      monitoringStore: {
        listActiveCompanies: vi.fn(),
        countRecentWebhookFailures: vi.fn(),
        pingDatabase: vi.fn(),
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe(GENERIC_FORBIDDEN);
    }
  });

  it("aggregates adapter healthCheck and webhook failure counts for admins", async () => {
    const registry = new PaymentProviderRegistry();
    registry.register(stripeAdapter());

    const companyId = "cccccccc-cccc-4ccc-8ccc-000000000099";
    const gatewayStore = {
      getCompanyGatewayConfiguration: vi.fn().mockResolvedValue(gatewayConfiguration(companyId)),
    };

    const result = await getOperationalMonitoringSnapshot(admin, {
      monitoringStore: {
        listActiveCompanies: vi.fn().mockResolvedValue([{ id: companyId, displayName: "Acme" }]),
        countRecentWebhookFailures: vi
          .fn()
          .mockResolvedValue({ count: 1, lastFailureAt: new Date("2026-08-28T12:00:00.000Z") }),
        pingDatabase: vi.fn().mockResolvedValue(true),
      },
      gatewayStore,
      providerRegistry: registry,
      getBackupHealth: vi.fn().mockResolvedValue(mockBackupSnapshot()),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const stripe = result.data.gateways.find(
        (row) => row.companyId === companyId && row.methodCode === "STRIPE",
      );
      expect(stripe).toMatchObject({
        adapterStatus: "HEALTHY",
        adapterHealthy: true,
        webhookStatus: "DEGRADED",
        recentWebhookFailures: 1,
      });
    }
  });
});
