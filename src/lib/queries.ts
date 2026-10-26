import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatDate, formatEventRange, formatTime, formatDayLong } from "@/lib/tz";
import type { EventCardData } from "@/components/events/EventCard";
import type { Locale } from "@/i18n/core";

/**
 * One cache tag for everything the public catalogue shows (events page,
 * landing strip). Every mutation that changes what a visitor sees calls
 * revalidateTag(EVENTS_TAG) in src/lib/actions/*.ts, so the lists are
 * never stale after an RSVP, approval, or cancellation.
 */
export const EVENTS_TAG = "events";

/**
 * Published events that haven't ended yet, formatted for EventCard.
 * Cached for 60s — the pages around it stay dynamic (session read), so
 * only the database work is shared across requests.
 * Serialization happens HERE: cached payloads must be plain JSON, and
 * dates are formatted on the server so client tzdata never disagrees.
 */
export const getPublishedEvents = unstable_cache(
  async (locale: Locale): Promise<EventCardData[]> => {
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
      dateLabel: formatDate(e.startsAt, locale),
      rangeLabel: formatEventRange(e.startsAt, e.endsAt, locale),
      dayLabel: formatDayLong(e.startsAt, locale),
    }));
  },
  ["published-events", "locale"],
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
  async (locale: Locale): Promise<StripItem[]> => {
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
      dateLabel: formatDate(e.startsAt, locale),
      timeLabel: formatTime(e.startsAt),
      spotsLeft: e.capacity !== null ? e.capacity - e._count.rsvps : null,
    }));
  },
  ["upcoming-strip", "locale"],
  { revalidate: 60, tags: [EVENTS_TAG] }
);

/**
 * Landing proof band: club names that have published upcoming events,
 * plus a couple that exist in the catalogue — the wall of organisers.
 * Additive query for the redesign; same cache tag as the rest of the
 * public catalogue, so admin club edits revalidate it too.
 */
export const getClubNames = unstable_cache(
  async (): Promise<string[]> => {
    const clubs = await prisma.club.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    });
    return clubs.map((c) => c.name);
  },
  ["club-names"],
  { revalidate: 300, tags: [EVENTS_TAG] }
);

/** Landing: two honest figures, straight from the catalogue. */
export const getLandingStats = unstable_cache(
  async (): Promise<{ upcomingEvents: number; confirmedRsvps: number }> => {
    const now = new Date();
    const published = await prisma.event.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, endsAt: true },
    });
    const upcomingIds = published.filter((e) => e.endsAt >= now).map((e) => e.id);
    const confirmedRsvps = await prisma.rsvp.count({
      where: { status: "CONFIRMED", eventId: { in: upcomingIds } },
    });
    return { upcomingEvents: upcomingIds.length, confirmedRsvps };
  },
  ["landing-stats"],
  { revalidate: 60, tags: [EVENTS_TAG] }
);
