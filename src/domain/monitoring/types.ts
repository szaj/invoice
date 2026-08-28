import type { BackupHealthSnapshot } from "@/domain/backup/types";
import type { GatewayConfigStatus } from "@/domain/gateway-config/types";
import type { ProviderHealthStatus } from "@/domain/payments/providers/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";

export const APPLICATION_HEALTH_STATUSES = ["HEALTHY", "DEGRADED", "UNHEALTHY"] as const;
export type ApplicationHealthStatus = (typeof APPLICATION_HEALTH_STATUSES)[number];

export const WEBHOOK_HEALTH_STATUSES = ["HEALTHY", "DEGRADED", "DISABLED"] as const;
export type WebhookHealthStatus = (typeof WEBHOOK_HEALTH_STATUSES)[number];

export const WEBHOOK_FAILURE_LOOKBACK_HOURS = 24;

export type GatewayOperationalHealth = {
  readonly companyId: string;
  readonly companyDisplayName: string;
  readonly methodCode: PaymentMethodCode;
  readonly methodEnabled: boolean;
  readonly configStatus: GatewayConfigStatus;
  readonly adapterStatus: ProviderHealthStatus | null;
  readonly adapterHealthy: boolean | null;
  readonly webhookStatus: WebhookHealthStatus;
  readonly recentWebhookFailures: number;
  readonly lastWebhookFailureAt: string | null;
};

export type ApplicationHealthCheck = {
  readonly status: ApplicationHealthStatus;
  readonly database: boolean;
  readonly queueConfigured: boolean;
  readonly sentryConfigured: boolean;
};

export type OperationalMonitoringSnapshot = {
  readonly application: ApplicationHealthCheck;
  readonly gateways: readonly GatewayOperationalHealth[];
  readonly backup: BackupHealthSnapshot;
};

export function deriveWebhookHealthStatus(input: {
  readonly supportsWebhooks: boolean;
  readonly methodEnabled: boolean;
  readonly recentWebhookFailures: number;
}): WebhookHealthStatus {
  if (!input.supportsWebhooks || !input.methodEnabled) {
    return "DISABLED";
  }
  if (input.recentWebhookFailures > 0) {
    return "DEGRADED";
  }
  return "HEALTHY";
}

export function deriveApplicationHealthStatus(input: {
  readonly database: boolean;
}): ApplicationHealthStatus {
  if (!input.database) {
    return "UNHEALTHY";
  }
  return "HEALTHY";
}
