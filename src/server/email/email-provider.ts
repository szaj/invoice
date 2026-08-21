/**
 * Email provider boundary (ADR-007).
 * Invoice/notification modules must not import the Resend SDK.
 */

export type EmailAttachment = {
  readonly filename: string;
  readonly contentType: string;
  readonly content: Uint8Array;
};

export type SendEmailInput = {
  readonly to: string;
  readonly from: string;
  readonly replyTo?: string | null;
  /** Optional CC recipients (TASK-042). */
  readonly cc?: readonly string[];
  /** Optional BCC recipients (TASK-042). */
  readonly bcc?: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly html?: string | null;
  readonly attachments?: readonly EmailAttachment[];
};

export type SendEmailResult = {
  readonly providerMessageId: string | null;
};

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
