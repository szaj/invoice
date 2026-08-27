/**
 * Authoritative system timestamps are UTC.
 * Display timezones are applied at the presentation boundary (audit viewer and later UI).
 */
export function nowUtc(): Date {
  return new Date();
}

/**
 * Format a UTC instant for display in an IANA timezone.
 * Falls back to the UTC ISO prefix when the zone is invalid.
 */
export function formatTimestampInTimeZone(date: Date, timeZone: string): string {
  const zone = timeZone.trim().length > 0 ? timeZone.trim() : "UTC";
  try {
    const formatted = date.toLocaleString("sv-SE", { timeZone: zone, hour12: false });
    return `${formatted} ${zone}`;
  } catch {
    return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
  }
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
