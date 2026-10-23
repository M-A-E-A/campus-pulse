import { prisma } from "@/lib/prisma";
import { CAMPUS_TZ } from "@/lib/tz";
import { buildVCalendar, type VEvent } from "@/lib/ics";

/**
 * Personal ICS subscription feed: /api/calendar/<secret token>.
 *
 * The token IS the credential (the standard calendar-subscription pattern —
 * Google/Apple poll the URL with no other auth). It's a 192-bit random
 * value stored on the user; rotating it kills every old link at once.
 *
 * Privacy note: the feed deliberately does NOT include the raw ticket code —
 * calendar files sync to lock screens and shared inboxes. The event page
 * link in each description gets students there with one tap.
 */

const APP_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return new Response("Not found", { status: 404 });

  const user = await prisma.user.findUnique({
    where: { calendarToken: token },
    select: { id: true },
  });
  if (!user) return new Response("Not found", { status: 404 });

  const rsvps = await prisma.rsvp.findMany({
    where: {
      userId: user.id,
      status: "CONFIRMED",
      event: { status: "PUBLISHED", endsAt: { gte: new Date() } },
    },
    orderBy: { event: { startsAt: "asc" } },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          startsAt: true,
          endsAt: true,
          club: { select: { name: true } },
        },
      },
    },
  });

  const events: VEvent[] = rsvps.map((r) => ({
    uid: `${r.id}@campus-pulse`,
    title: r.event.title,
    description: `${r.event.club.name}\n${APP_BASE}/events/${r.event.id}`,
    location: `${r.event.location} (${CAMPUS_TZ})`,
    startsAt: r.event.startsAt,
    endsAt: r.event.endsAt,
  }));

  return new Response(buildVCalendar(events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Inline, not an attachment: subscription apps fetch this repeatedly.
      "Cache-Control": "no-store",
    },
  });
}
