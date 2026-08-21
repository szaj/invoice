export type SystemSettingsRecord = {
  readonly id: string;
  readonly reportingCurrencyCode: string;
  readonly defaultTimezone: string;
  /** Decimal string for wire/API; never JavaScript number for money-adjacent values. */
  readonly roundingTolerance: string;
  /** Optional YYYY segment in allocated invoice numbers (TASK-035). */
  readonly invoiceNumberIncludeYear: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export const SYSTEM_SETTINGS_INVALID_INPUT = "Check the system settings and try again.";
export const SYSTEM_SETTINGS_NOT_FOUND = "System settings are not configured.";
export const SYSTEM_SETTINGS_UNAVAILABLE = "System settings are temporarily unavailable.";

/** Seeded singleton id from TASK-013 migration. */
export const SYSTEM_SETTINGS_SINGLETON_ID = "cccccccc-cccc-4ccc-8ccc-000000000001";
