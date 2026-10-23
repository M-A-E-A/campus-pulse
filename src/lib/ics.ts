// Shared ICS building blocks, used by the per-event download
// (/api/events/[id]/calendar) and the personal subscription feed
// (/api/calendar/[token]). Pure functions — no DB, no Next.js context.

/** RFC 5545 escaping for TEXT values. */
export function icsEscape(value: string): string {
  return value.replace(/([\\,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

/** 2026-03-14T18:30:00.000Z -> 20260314T183000Z */
export function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export type VEvent = {
  uid: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
};

/** One VEVENT block, folded into CRLF lines. */
export function buildVEvent(e: VEvent, stamp: Date): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(stamp)}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(e.endsAt)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `DESCRIPTION:${icsEscape(e.description)}`,
    `LOCATION:${icsEscape(e.location)}`,
    "END:VEVENT",
  ];
}

/** Wrap one or more VEVENTs in a VCALENDAR envelope. */
export function buildVCalendar(events: VEvent[]): string {
  const stamp = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Campus Pulse//EN",
    "CALSCALE:GREGORIAN",
    ...events.flatMap((e) => buildVEvent(e, stamp)),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
