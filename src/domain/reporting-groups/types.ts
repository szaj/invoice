export type ReportingGroupStatus = "ACTIVE" | "INACTIVE";

export type ReportingGroupMember = {
  readonly id: string;
  readonly displayName: string;
  readonly status: "ACTIVE" | "INACTIVE";
};

/**
 * Optional parent reporting group for consolidated report roll-ups.
 * Membership is not authorization; company access remains user_companies.
 */
export type ReportingGroupRecord = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly status: ReportingGroupStatus;
  readonly displayOrder: number;
  readonly companyIds: readonly string[];
  readonly companies: readonly ReportingGroupMember[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export const REPORTING_GROUP_NOT_FOUND = "Reporting group not found.";
export const REPORTING_GROUP_INVALID_INPUT = "Check the reporting group details and try again.";
export const REPORTING_GROUP_UNAVAILABLE = "Reporting group management is temporarily unavailable.";
export const REPORTING_GROUP_CODE_CONFLICT = "A reporting group with this code already exists.";
