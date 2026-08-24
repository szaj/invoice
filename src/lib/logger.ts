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
      "cookie",
      "cookies",
      "accessToken",
      "refreshToken",
      "recoveryToken",
      "tokenHash",
      "token_hash",
      "apiKey",
      "*.password",
      "*.secret",
      "*.token",
      "*.authorization",
      "*.cookie",
      "*.cookies",
      "*.accessToken",
      "*.refreshToken",
      "*.recoveryToken",
      "*.tokenHash",
      "*.token_hash",
      "*.apiKey",
      "*.accessKey",
      "*.webhookSecret",
      "*.credentials",
      "*.ciphertext",
      "*.credentialsCiphertext",
      "*.wrappedDek",
      "*.dek",
      "*.kek",
      "*.nonce",
      "*.authTag",
      "*.apiSecret",
      "*.secretKey",
      "*.publishableKey",
      "*.clientId",
      "*.clientSecret",
      "*.webhookId",
      "GATEWAY_CREDENTIALS_KEY_V1",
      "GATEWAY_CREDENTIALS_KEY_V2",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "PAYPAL_CLIENT_ID",
      "PAYPAL_CLIENT_SECRET",
      "PAYPAL_WEBHOOK_ID",
    ],
    censor: "[Redacted]",
  },
});
