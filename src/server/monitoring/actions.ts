"use server";

import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import { getOperationalMonitoringSnapshot } from "@/server/monitoring/monitoring-service";

export async function loadOperationalMonitoringForAdmin() {
  const actor = await getRequestAuthorizationPrincipal();
  return getOperationalMonitoringSnapshot(actor);
}
