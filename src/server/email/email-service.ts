import "server-only";

import { getEnv } from "@/config/env";
import { createEmailProvider } from "@/server/email/create-email-provider";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "@/server/email/email-provider";

/**
 * Application email facade (ADR-007).
 * Domain modules call EmailService; only adapters talk to providers.
 */
export class EmailService {
  constructor(
    private readonly provider: EmailProvider,
    private readonly defaultFrom: string | null,
  ) {}

  async send(
    input: Omit<SendEmailInput, "from"> & { readonly from?: string },
  ): Promise<SendEmailResult> {
    const from = input.from?.trim() || this.defaultFrom;
    if (!from) {
      throw new Error("EMAIL_FROM is required to send email.");
    }
    return this.provider.send({ ...input, from });
  }
}

export function createEmailService(provider?: EmailProvider): EmailService {
  const env = getEnv();
  const localFallback =
    env.APP_ENV === "local" || env.NODE_ENV === "test" ? "noreply@localhost.test" : null;
  return new EmailService(provider ?? createEmailProvider(env), env.EMAIL_FROM ?? localFallback);
}
