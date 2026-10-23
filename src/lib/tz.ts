// All event times are stored in UTC. Everything the user sees goes through
// this module so the campus time zone is applied in exactly one place.

export const CAMPUS_TZ = process.env.CAMPUS_TZ ?? "Africa/Casablanca";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAMPUS_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAMPUS_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "Sat, 14 Mar 2026" in the campus time zone. */
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** "18:30" in the campus time zone. */
export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

/** Short month chip, e.g. "Mar" — campus zone. */
export function formatMonthShort(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: CAMPUS_TZ, month: "short" }).format(date);
}

/** Day-of-month chip, e.g. "14" — campus zone. */
export function formatDayNumber(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: CAMPUS_TZ, day: "numeric" }).format(date);
}

/** "Sat, 14 Mar 2026 · 18:30" */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/** True when both dates fall on the same day in the campus time zone. */
export function isSameCampusDay(a: Date, b: Date): boolean {
  return dateFormatter.format(a) === dateFormatter.format(b);
}

/** Human range: "18:30–21:00" or "Fri 14 Mar 18:30 – Sat 15 Mar 01:00" for overnight events. */
export function formatEventRange(start: Date, end: Date): string {
  if (isSameCampusDay(start, end)) {
    return `${formatTime(start)}–${formatTime(end)}`;
  }
  return `${formatDate(start)} ${formatTime(start)} – ${formatDate(end)} ${formatTime(end)}`;
}

/**
 * Datetime-local input value for an existing date, expressed in the campus
 * time zone so organizers edit what they see, not UTC.
 */
export function toLocalInputValue(date: Date): string {
  // en-CA gives ISO-style YYYY-MM-DD.
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return `${day}T${formatTime(date)}`;
}

/**
 * Parse a datetime-local input (which has no zone) as campus-local time
 * and return the UTC instant to store.
 */
export function fromLocalInputValue(value: string): Date {
  // Interpret the wall-clock time as if it were in the campus zone by
  // measuring the zone's offset at that moment.
  const naive = new Date(`${value}:00Z`);
  const offset = getCampusOffsetMinutes(naive);
  return new Date(naive.getTime() - offset * 60_000);
}

/** Zone offset (minutes) for the campus time zone at a given instant. */
function getCampusOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(at).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}
