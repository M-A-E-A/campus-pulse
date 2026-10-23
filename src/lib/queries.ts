import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CAMPUS_TZ, formatDate, formatEventRange, formatTime } from "@/lib/tz";
import type { EventCardData } from "@/components/events/EventCard";

/**
 * One cache tag for everything the public catalogue shows (events page,
 * landing strip). Every mutation that changes what a visitor sees calls
 * revalidateTag(EVENTS_TAG) in src/lib/actions/*.ts, so the lists are
 * never stale after an RSVP, approval, or cancellation.
 */
export const EVENTS_TAG = "events";

const dayLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAMPUS_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Published events that haven't ended yet, formatted for EventCard.
 * Cached for 60s — the pages around it stay dynamic (session read), so
 * only the database work is shared across requests.
 * Serialization happens HERE: cached payloads must be plain JSON, and
 * dates are formatted on the server so client tzdata never disagrees.
 */
export const getPublishedEvents = unstable_cache(
  async (): Promise<EventCardData[]> => {
    const now = new Date();
    const events = await prisma.event.findMany({
      where: { status: "PUBLISHED", endsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      include: {
        club: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { rsvps: { where: { status: "CONFIRMED" } } } },
      },
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      coverImage: e.coverImage,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      location: e.location,
      capacity: e.capacity,
      club: e.club,
      category: e.category,
      _count: e._count,
      dateLabel: formatDate(e.startsAt),
      rangeLabel: formatEventRange(e.startsAt, e.endsAt),
      dayLabel: dayLabelFormatter.format(e.startsAt),
    }));
  },
  ["published-events"],
  { revalidate: 60, tags: [EVENTS_TAG] }
);

/** Category filter list for the events page. */
export const getCategories = unstable_cache(
  async () =>
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ["categories"],
  { revalidate: 300, tags: [EVENTS_TAG] }
);

export type StripItem = {
  id: string;
  title: string;
  categoryName: string;
  clubName: string;
  dateLabel: string;
  timeLabel: string;
  /** null = unlimited capacity. */
  spotsLeft: number | null;
};

/** Landing "Coming up" strip: the next six events, labels precomputed. */
export const getUpcomingStrip = unstable_cache(
  async (): Promise<StripItem[]> => {
    const now = new Date();
    const events = await prisma.event.findMany({
      where: { status: "PUBLISHED", endsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 6,
      include: {
        club: { select: { name: true } },
        category: { select: { name: true } },
        _count: { select: { rsvps: { where: { status: "CONFIRMED" } } } },
      },
    });

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      categoryName: e.category.name,
      clubName: e.club.name,
      dateLabel: formatDate(e.startsAt),
      timeLabel: formatTime(e.startsAt),
      spotsLeft: e.capacity !== null ? e.capacity - e._count.rsvps : null,
    }));
  },
  ["upcoming-strip"],
  { revalidate: 60, tags: [EVENTS_TAG] }
);
