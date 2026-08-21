import "server-only";

import { Resend } from "resend";

import type { EmailProvider, SendEmailInput, SendEmailResult } from "@/server/email/email-provider";

/**
 * Resend adapter (ADR-007). The only module allowed to call the Resend SDK.
 */
export class ResendEmailAdapter implements EmailProvider {
  private readonly client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const result = await this.client.emails.send({
      from: input.from,
      to: input.to,
      replyTo: input.replyTo ?? undefined,
      cc: input.cc && input.cc.length > 0 ? [...input.cc] : undefined,
      bcc: input.bcc && input.bcc.length > 0 ? [...input.bcc] : undefined,
      subject: input.subject,
      text: input.text,
      html: input.html ?? undefined,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.content),
        contentType: attachment.contentType,
      })),
    });

    if (result.error) {
      throw new Error(result.error.message || "Resend email send failed.");
    }

    return { providerMessageId: result.data?.id ?? null };
  }
}
