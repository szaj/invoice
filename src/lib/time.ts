/**
 * Authoritative system timestamps are UTC.
 * Display timezones are applied at the presentation boundary in later tasks.
 */
export function nowUtc(): Date {
  return new Date();
}

export function toUtcIsoString(date: Date = nowUtc()): string {
  return date.toISOString();
}

export function parseUtcIsoString(value: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid UTC timestamp");
  }

  return date;
}
