import type { EmailProvider, SendEmailInput, SendEmailResult } from "@/server/email/email-provider";

/**
 * In-memory provider for unit/integration tests. Not for production.
 */
export class MemoryEmailProvider implements EmailProvider {
  readonly sent: SendEmailInput[] = [];
  failNextWith: string | null = null;

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (this.failNextWith) {
      const message = this.failNextWith;
      this.failNextWith = null;
      throw new Error(message);
    }
    this.sent.push({
      ...input,
      attachments: input.attachments?.map((attachment) => ({
        ...attachment,
        content: Uint8Array.from(attachment.content),
      })),
    });
    return { providerMessageId: `memory-${this.sent.length}` };
  }
}
