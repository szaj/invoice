import { blankToUndefined } from "@/config/env-schema";

import { scrubSentryEvent } from "@/lib/sentry/scrub";

export type SentryRuntime = "server" | "client" | "edge" | "worker";

type SentryInitOptions = {
  dsn?: string;
  enabled?: boolean;
  environment?: string;
  tracesSampleRate?: number;
  serverName?: string;
  beforeSend?: (event: Parameters<typeof scrubSentryEvent>[0], hint: Parameters<typeof scrubSentryEvent>[1]) => ReturnType<typeof scrubSentryEvent>;
};

function readAppEnv(): string {
  return blankToUndefined(process.env.APP_ENV) ?? "local";
}

export function resolveSentryDsn(runtime: SentryRuntime): string | undefined {
  if (runtime === "client") {
    return (
      blankToUndefined(process.env.NEXT_PUBLIC_SENTRY_DSN) ??
      blankToUndefined(process.env.SENTRY_DSN)
    );
  }
  return (
    blankToUndefined(process.env.SENTRY_DSN) ??
    blankToUndefined(process.env.NEXT_PUBLIC_SENTRY_DSN)
  );
}

export function isSentryConfigured(runtime: SentryRuntime = "server"): boolean {
  const dsn = resolveSentryDsn(runtime);
  return typeof dsn === "string" && dsn.length > 0;
}

function baseOptions(runtime: SentryRuntime): SentryInitOptions {
  const dsn = resolveSentryDsn(runtime);
  const enabled = typeof dsn === "string" && dsn.length > 0;
  const appEnv = readAppEnv();

  return {
    dsn,
    enabled,
    environment: appEnv,
    tracesSampleRate: appEnv === "production" ? 0.1 : 1,
    beforeSend(event, hint) {
      return scrubSentryEvent(event, hint);
    },
  };
}

export function buildSentryServerOptions(): SentryInitOptions {
  return baseOptions("server");
}

export function buildSentryEdgeOptions(): SentryInitOptions {
  return baseOptions("edge");
}

export function buildSentryWorkerOptions(): SentryInitOptions {
  return {
    ...baseOptions("worker"),
    serverName: "invoices-worker",
  };
}

export function buildSentryClientOptions(): SentryInitOptions {
  return baseOptions("client");
}
