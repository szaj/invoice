/**
 * Queueable operational notifications (ADR-005 / TASK-091).
 * Inline dispatcher runs immediately; TASK-099 can swap in BullMQ workers.
 */

import type { OperationalNotificationEvent } from "@/domain/notifications/types";

export type OperationalNotificationJob = {
  readonly event: OperationalNotificationEvent;
  readonly recipients: readonly string[];
  readonly subject: string;
  readonly text: string;
};

export interface OperationalNotificationJobDispatcher {
  dispatch(job: OperationalNotificationJob): Promise<void>;
}

export type OperationalNotificationSendFn = (job: OperationalNotificationJob) => Promise<void>;

export class InlineOperationalNotificationJobDispatcher implements OperationalNotificationJobDispatcher {
  constructor(private readonly send: OperationalNotificationSendFn) {}

  async dispatch(job: OperationalNotificationJob): Promise<void> {
    await this.send(job);
  }
}
