// All event times are stored in UTC. Everything the user sees goes through
// this module so the campus time zone is applied in exactly one place.

import type { Locale } from "@/i18n/core";

export const CAMPUS_TZ = process.env.CAMPUS_TZ ?? "Africa/Casablanca";

/**
 * BCP-47 tag per UI locale. A French or Arabic page must not print English
 * weekday names under its headline, so dates follow the dictionary. `en` keeps
 * the original en-GB output: callers that do not pass a locale render exactly
 * what they did before.
 */
const DATE_LOCALE: Record<Locale, string> = { en: "en-GB", fr: "fr-FR", ar: "ar-MA" };

/** Formatters are expensive and locale is per-request, so cache them by locale. */
const dateFormatters = new Map<Locale, Intl.DateTimeFormat>();
const dayFormatters = new Map<Locale, Intl.DateTimeFormat>();
const monthFormatters = new Map<Locale, Intl.DateTimeFormat>();

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAMPUS_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function dateFormatterFor(locale: Locale): Intl.DateTimeFormat {
  let f = dateFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
      timeZone: CAMPUS_TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    dateFormatters.set(locale, f);
  }
  return f;
}

function dayFormatterFor(locale: Locale): Intl.DateTimeFormat {
  let f = dayFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
      timeZone: CAMPUS_TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    dayFormatters.set(locale, f);
  }
  return f;
}

function monthFormatterFor(locale: Locale): Intl.DateTimeFormat {
  let f = monthFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
      timeZone: CAMPUS_TZ,
      month: "short",
    });
    monthFormatters.set(locale, f);
  }
  return f;
}

/** "Sat, 14 Mar 2026" in the campus time zone, in `locale`. */
export function formatDate(date: Date, locale: Locale = "en"): string {
  return dateFormatterFor(locale).format(date);
}

/** "18:30" in the campus time zone. Digits are Latin in every UI locale. */
export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

/** Short month chip, e.g. "Mar" — campus zone, in `locale`. */
export function formatMonthShort(date: Date, locale: Locale = "en"): string {
  return monthFormatterFor(locale).format(date);
}

/** Day-of-month chip, e.g. "14" — campus zone. */
export function formatDayNumber(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: CAMPUS_TZ, day: "numeric" }).format(date);
}

/** "Saturday, 14 March 2026" — long day label used to group event lists. */
export function formatDayLong(date: Date, locale: Locale = "en"): string {
  return dayFormatterFor(locale).format(date);
}

/** "Sat, 14 Mar 2026 · 18:30" */
export function formatDateTime(date: Date, locale: Locale = "en"): string {
  return `${formatDate(date, locale)} · ${formatTime(date)}`;
}

/**
 * True when both dates fall on the same day in the campus time zone.
 * Compared with one fixed formatter on both sides — a predicate, not a label —
 * so the answer is identical whatever locale is being displayed.
 */
export function isSameCampusDay(a: Date, b: Date): boolean {
  const f = dateFormatterFor("en");
  return f.format(a) === f.format(b);
}

/** Human range: "18:30–21:00" or "Fri 14 Mar 18:30 – Sat 15 Mar 01:00" for overnight events. */
export function formatEventRange(start: Date, end: Date, locale: Locale = "en"): string {
  if (isSameCampusDay(start, end)) {
    return `${formatTime(start)}–${formatTime(end)}`;
  }
  return `${formatDate(start, locale)} ${formatTime(start)} – ${formatDate(end, locale)} ${formatTime(end)}`;
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

// ---- Filtering helpers ----
// The date filters ("today", "next 7 days") must agree with the labels the
// user reads, which are all rendered in the campus zone. Comparing raw UTC or
// the browser's own zone made "today" drift from the printed date whenever the
// visitor's device was outside Africa/Casablanca.

/** Campus-local calendar day for an instant, e.g. "2026-03-14". */
export function campusDayKey(at: Date): string {
  // en-CA gives ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * Campus-local start of the day `dayKey` as a UTC instant. Built through the
 * zone's offset so DST in Africa/Casablanca is respected.
 */
function campusDayStart(dayKey: string): Date {
  const naive = new Date(`${dayKey}T00:00:00Z`);
  return new Date(naive.getTime() - getCampusOffsetMinutes(naive) * 60_000);
}

/** Today's campus-local calendar day, as a comparable YYYY-MM-DD key. */
export function campusTodayKey(): string {
  return campusDayKey(new Date());
}

/**
 * Campus-local start of the day `days` ahead of today — the inclusive upper
 * bound for a "next N days" filter.
 */
export function campusDayLimit(days: number): Date {
  const naive = new Date(`${campusDayKey(new Date())}T00:00:00Z`);
  naive.setUTCDate(naive.getUTCDate() + days);
  return campusDayStart(campusDayKey(naive));
}
