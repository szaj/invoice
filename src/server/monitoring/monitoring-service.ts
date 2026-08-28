import "server-only";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import {
  deriveApplicationHealthStatus,
  deriveWebhookHealthStatus,
  WEBHOOK_FAILURE_LOOKBACK_HOURS,
  type ApplicationHealthCheck,
  type GatewayOperationalHealth,
  type OperationalMonitoringSnapshot,
} from "@/domain/monitoring/types";
import type { BackupHealthSnapshot } from "@/domain/backup/types";
import { providerSupports } from "@/domain/payments/providers/capabilities";
import type { PaymentProviderRegistry } from "@/domain/payments/providers/registry";
import type { PaymentProviderGatewayConfig } from "@/domain/payments/providers/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import { isQueueEnabled } from "@/server/queue/config";
import { PrismaGatewayConfigStore } from "@/server/gateway-config/gateway-config-repository";
import { isSentryConfigured } from "@/lib/sentry/options";
import { getBackupHealthSnapshot } from "@/server/backup/backup-service";
import { createPaymentProviderRegistry } from "@/server/payments/providers/create-payment-provider-registry";
import { PrismaMonitoringStore } from "@/server/monitoring/monitoring-repository";

export type MonitoringResult<T> =
  { ok: true; data: T } | { ok: false; status: 403 | 503; error: string };

export interface MonitoringServiceDependencies {
  readonly monitoringStore?: Pick<
    PrismaMonitoringStore,
    "listActiveCompanies" | "countRecentWebhookFailures" | "pingDatabase"
  >;
  readonly gatewayStore?: Pick<PrismaGatewayConfigStore, "getCompanyGatewayConfiguration">;
  readonly providerRegistry?: PaymentProviderRegistry;
  readonly getBackupHealth?: () => Promise<BackupHealthSnapshot>;
}

function monitoringStoreOf(
  deps: MonitoringServiceDependencies,
): Pick<
  PrismaMonitoringStore,
  "listActiveCompanies" | "countRecentWebhookFailures" | "pingDatabase"
> {
  return deps.monitoringStore ?? new PrismaMonitoringStore();
}

function gatewayStoreOf(
  deps: MonitoringServiceDependencies,
): Pick<PrismaGatewayConfigStore, "getCompanyGatewayConfiguration"> {
  return deps.gatewayStore ?? new PrismaGatewayConfigStore();
}

function registryOf(deps: MonitoringServiceDependencies): PaymentProviderRegistry {
  return deps.providerRegistry ?? createPaymentProviderRegistry();
}

function requireMonitoringView(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "settings.manage");
}

export async function getApplicationHealth(
  deps: MonitoringServiceDependencies = {},
): Promise<ApplicationHealthCheck> {
  const store = monitoringStoreOf(deps);
  const database = await store.pingDatabase();
  return {
    status: deriveApplicationHealthStatus({ database }),
    database,
    queueConfigured: isQueueEnabled(),
    sentryConfigured: isSentryConfigured("server"),
  };
}

async function buildGatewayHealthRow(
  company: { readonly id: string; readonly displayName: string },
  methodCode: PaymentMethodCode,
  deps: MonitoringServiceDependencies,
): Promise<GatewayOperationalHealth | null> {
  const gatewayStore = gatewayStoreOf(deps);
  const registry = registryOf(deps);
  const monitoringStore = monitoringStoreOf(deps);

  const configuration = await gatewayStore.getCompanyGatewayConfiguration(company.id);
  if (!configuration) {
    return null;
  }

  const method = configuration.methods.find((row) => row.methodCode === methodCode);
  if (!method) {
    return null;
  }

  const provider = registry.get(methodCode);
  const supportsWebhooks = provider ? providerSupports(provider, "supportsWebhooks") : false;
  const supportsHealthCheck = provider ? providerSupports(provider, "supportsHealthCheck") : false;

  const since = new Date(Date.now() - WEBHOOK_FAILURE_LOOKBACK_HOURS * 60 * 60 * 1000);
  const webhookFailures =
    supportsWebhooks && method.methodEnabled
      ? await monitoringStore.countRecentWebhookFailures({
          companyId: company.id,
          methodCode,
          since,
        })
      : { count: 0, lastFailureAt: null };

  let adapterStatus: GatewayOperationalHealth["adapterStatus"] = null;
  let adapterHealthy: boolean | null = null;

  if (provider && supportsHealthCheck && method.methodEnabled) {
    const providerConfig: PaymentProviderGatewayConfig = {
      companyId: company.id,
      methodCode,
      enabled: method.methodEnabled,
      environment: method.environment,
      enabledSettlementCurrencyCodes: method.enabledSettlementCurrencyCodes,
      credentialsConfigured: method.credentialsConfigured,
    };
    try {
      const health = await provider.healthCheck(providerConfig);
      adapterStatus = health.status;
      adapterHealthy = health.healthy;
    } catch (error) {
      logger.warn(
        {
          event: "monitoring.adapter_health_failed",
          companyId: company.id,
          methodCode,
          err: error instanceof Error ? error.message : "unknown",
        },
        "Gateway adapter health check failed",
      );
      adapterStatus = "CONFIGURATION_ERROR";
      adapterHealthy = false;
    }
  }

  return {
    companyId: company.id,
    companyDisplayName: company.displayName,
    methodCode,
    methodEnabled: method.methodEnabled,
    configStatus: method.status,
    adapterStatus,
    adapterHealthy,
    webhookStatus: deriveWebhookHealthStatus({
      supportsWebhooks,
      methodEnabled: method.methodEnabled,
      recentWebhookFailures: webhookFailures.count,
    }),
    recentWebhookFailures: webhookFailures.count,
    lastWebhookFailureAt: webhookFailures.lastFailureAt?.toISOString() ?? null,
  };
}

export async function getOperationalMonitoringSnapshot(
  actor: AuthorizationPrincipal | null,
  deps: MonitoringServiceDependencies = {},
): Promise<MonitoringResult<OperationalMonitoringSnapshot>> {
  try {
    requireMonitoringView(actor);
    const store = monitoringStoreOf(deps);
    const companies = await store.listActiveCompanies();
    const methodCodes: PaymentMethodCode[] = ["STRIPE", "PAYPAL", "MANUAL", "BANK_PROCESSOR"];

    const gatewayRows = (
      await Promise.all(
        companies.flatMap((company) =>
          methodCodes.map((methodCode) => buildGatewayHealthRow(company, methodCode, deps)),
        ),
      )
    ).filter((row): row is GatewayOperationalHealth => row != null);

    const [application, backup] = await Promise.all([
      getApplicationHealth(deps),
      deps.getBackupHealth ? deps.getBackupHealth() : getBackupHealthSnapshot(),
    ]);

    return {
      ok: true,
      data: {
        application,
        gateways: gatewayRows,
        backup,
      },
    };
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const status = error.status;
      if (status === 401 || status === 403) {
        return {
          ok: false,
          status: 403,
          error:
            typeof error === "object" && "message" in error && typeof error.message === "string"
              ? error.message
              : "You do not have permission to perform this action.",
        };
      }
    }

    logger.error(
      {
        event: "monitoring.unavailable",
        err: error instanceof Error ? error.message : "unknown",
      },
      "Operational monitoring failed",
    );
    return { ok: false, status: 503, error: "Operational monitoring is temporarily unavailable." };
  }
}
