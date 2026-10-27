import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/tz";
import type { Locale } from "@/i18n/core";
import type { NotificationType } from "@prisma/client";

export type NotificationView = {
  id: string;
  type: NotificationType;
  read: boolean;
  /** Where the row should take the reader, or null when there's nowhere to go. */
  href: string | null;
  /** Live data for the message, resolved here — never stored on the row. */
  title: string | null;
  club: string | null;
  /** Reminder slot ("reminder:24h" / "reminder:1h") when the type is a reminder. */
  dedupeKey: string | null;
  /** Campus-timezone stamp, formatted here so client tzdata never disagrees. */
  timeLabel: string;
};

/**
 * The bell's data for ONE user, plus their unread count.
 *
 * Deliberately NOT wrapped in unstable_cache, unlike src/lib/queries.ts:
 * cached payloads are shared across requests, so a cached per-user feed would
 * hand one student's notifications to another. The Nav that renders the bell
 * reads the session via auth(), so the page is dynamic anyway.
 *
 * Why the link differs by type: /events/[id] calls notFound() for anything
 * that isn't PUBLISHED, so a cancelled event would 404 the reader — those rows
 * point at /dashboard, where the student's own RSVP row still lives.
 */
export async function getNotifications(
  userId: string,
  locale: Locale,
  take = 15
): Promise<{ unreadCount: number; items: NotificationView[] }> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        event: { select: { title: true, status: true, club: { select: { name: true } } } },
      },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const items = rows.map((r): NotificationView => {
    const published = r.event?.status === "PUBLISHED";
    return {
      id: r.id,
      type: r.type,
      read: r.readAt !== null,
      href:
        !r.eventId
          ? null // event was hard-deleted: nothing left to open
          : r.type === "EVENT_CANCELLED" || !published
            ? "/dashboard" // its own page would 404 — point at their RSVP row
            : `/events/${r.eventId}`,
      title: r.event?.title ?? null,
      club: r.event?.club?.name ?? null,
      dedupeKey: r.dedupeKey,
      timeLabel: formatDateTime(r.createdAt, locale),
    };
  });

  return { unreadCount, items };
}
