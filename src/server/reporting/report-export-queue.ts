/**
 * Queueable report export generation (ADR-005).
 * TASK-090 uses an inline dispatcher so exports work without a dedicated worker.
 * TASK-099 hardens BullMQ + Redis + worker processing; swap the dispatcher there.
 */

import type { AuthorizationPrincipal } from "@/domain/authz/authorize";

export type ReportExportJob = {
  readonly exportId: string;
  readonly reportType: string;
  readonly format: "csv" | "xlsx";
  readonly filters: Record<string, unknown>;
  readonly actor: AuthorizationPrincipal;
  readonly companyId: string | null;
};

export interface ReportExportJobDispatcher {
  dispatch(job: ReportExportJob): Promise<void>;
}

export type ReportExportProcessFn = (job: ReportExportJob) => Promise<void>;

export class InlineReportExportJobDispatcher implements ReportExportJobDispatcher {
  constructor(private readonly process: ReportExportProcessFn) {}

  async dispatch(job: ReportExportJob): Promise<void> {
    await this.process(job);
  }
}
