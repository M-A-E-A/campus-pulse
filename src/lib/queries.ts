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
 * Follow state and the club directory/profile caches. Event mutations
 * already revalidate EVENTS_TAG (an "upcoming" count moves the moment an
 * event is published, cancelled or ends); follow mutations revalidate this
 * second tag, since a follower count changes with no event involved.
 */
export const CLUBS_TAG = "clubs";

/**
 * The card projection, in one place: `getPublishedEvents` and
 * `getClubUpcomingEvents` feed the same EventCard from the same rows, so a
 * poster cannot look different on the events wall and on a club profile.
 * Serialization still happens in the caller above — this is pure mapping.
 */
type EventRow = {
  id: string;
  title: string;
  coverImage: string | null;
  startsAt: Date;
  endsAt: Date;
  location: string;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  club: { id: string; name: string };
  category: { id: string; name: string };
  _count: { rsvps: number };
};

function toEventCardData(e: EventRow, locale: Locale): EventCardData {
  return {
    id: e.id,
    title: e.title,
    coverImage: e.coverImage,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    location: e.location,
    lat: e.lat,
    lng: e.lng,
    capacity: e.capacity,
    club: e.club,
    category: e.category,
    _count: e._count,
    dateLabel: formatDate(e.startsAt, locale),
    rangeLabel: formatEventRange(e.startsAt, e.endsAt, locale),
    dayLabel: formatDayLong(e.startsAt, locale),
  };
}

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

    return events.map((e) => toEventCardData(e, locale));
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

/* ---- Clubs (Phase 12): the directory and the profile ---- */

export type ClubDirectoryEntry = {
  id: string;
  name: string;
  description: string;
  followers: number;
  /** Published events still to come / already over — both printed. */
  upcoming: number;
  past: number;
  /** The next event's start date, pre-formatted in the page locale
   *  (null = nothing on the calendar). Server-formatted like every other
   *  label: cached payloads are plain JSON and the browser never re-picks
   *  a timezone for text that is already a sentence. */
  nextLabel: string | null;
};

/**
 * Every club with the counts the directory and the profile both print.
 * The profile reuses this instead of running its own query: the table is
 * small, one cache entry serves both routes, and the two views can never
 * disagree about a follower count. Tagged with BOTH tags — the upcoming
 * count moves with event mutations, the follower count with follow ones.
 */
export const getClubDirectory = unstable_cache(
  async (locale: Locale): Promise<ClubDirectoryEntry[]> => {
    const now = new Date();
    const clubs = await prisma.club.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { followers: true } },
        events: {
          where: { status: "PUBLISHED" },
          orderBy: { startsAt: "asc" },
          select: { startsAt: true, endsAt: true },
        },
      },
    });

    return clubs.map((c) => {
      const upcoming = c.events.filter((e) => e.endsAt >= now);
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        followers: c._count.followers,
        upcoming: upcoming.length,
        past: c.events.length - upcoming.length,
        nextLabel: upcoming[0] ? formatDate(upcoming[0].startsAt, locale) : null,
      };
    });
  },
  ["club-directory", "locale"],
  { revalidate: 60, tags: [EVENTS_TAG, CLUBS_TAG] }
);

/** One club profile's upcoming events, as EventCards. */
export const getClubUpcomingEvents = unstable_cache(
  async (clubId: string, locale: Locale): Promise<EventCardData[]> => {
    const now = new Date();
    const events = await prisma.event.findMany({
      where: { status: "PUBLISHED", endsAt: { gte: now }, clubId },
      orderBy: { startsAt: "asc" },
      include: {
        club: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { rsvps: { where: { status: "CONFIRMED" } } } },
      },
    });
    return events.map((e) => toEventCardData(e, locale));
  },
  ["club-upcoming", "clubId", "locale"],
  { revalidate: 60, tags: [EVENTS_TAG, CLUBS_TAG] }
);

/**
 * The signed-in visitor's follow set, for the toggle's starting state.
 * Per-user on purpose — NOT cached: a shared cache entry would hand one
 * student's follow state to the next request that asked.
 */
export async function getFollowedClubIds(userId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({
    where: { userId },
    select: { clubId: true },
  });
  return rows.map((r) => r.clubId);
}
