import "server-only";

import pino from "pino";

import { getEnv } from "@/config/env";

const env = getEnv();

export const logger = pino({
  level: env.APP_ENV === "production" ? "info" : "debug",
  base: {
    service: "invoices-app",
    appEnv: env.APP_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "password",
      "secret",
      "token",
      "authorization",
      "apiKey",
      "*.password",
      "*.secret",
      "*.token",
      "*.authorization",
      "*.apiKey",
      "*.accessKey",
      "*.webhookSecret",
    ],
    censor: "[Redacted]",
  },
});
