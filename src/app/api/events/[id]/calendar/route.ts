import { prisma } from "@/lib/prisma";
import { CAMPUS_TZ } from "@/lib/tz";

/**
 * "Add to calendar" download: a standards-compliant .ics file with UTC
 * timestamps, so any calendar app shows the right campus-local time.
 */

function icsEscape(value: string): string {
  return value.replace(/([\\,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

/** 2026-03-14T18:30:00.000Z -> 20260314T183000Z */
function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || event.status !== "PUBLISHED") {
    return new Response("Not found", { status: 404 });
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Campus Pulse//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@campus-pulse`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(event.endsAt)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description)}`,
    `LOCATION:${icsEscape(event.location)} (times in ${CAMPUS_TZ})`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="campus-pulse-event.ics"',
      "Cache-Control": "no-store",
    },
  });
}
