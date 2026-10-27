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
 * Where a row should take its reader, shared by the bell and the push
 * dispatcher so a tap on a push lands exactly where a tap on the bell row does.
 *
 * Why the link differs by type: /events/[id] calls notFound() for anything
 * that isn't PUBLISHED, so a cancelled event would 404 the reader — those rows
 * point at /dashboard, where the student's own RSVP row still lives.
 *
 * `published` comes from the event relation: false for a cancelled event (its
 * status flipped away from PUBLISHED) and for anything else not live.
 */
export function notificationHref(
  type: NotificationType,
  eventId: string | null,
  published: boolean
): string | null {
  if (!eventId) return null; // event was hard-deleted: nothing left to open
  return type === "EVENT_CANCELLED" || !published ? "/dashboard" : `/events/${eventId}`;
}

/**
 * The bell's data for ONE user, plus their unread count.
 *
 * Deliberately NOT wrapped in unstable_cache, unlike src/lib/queries.ts:
 * cached payloads are shared across requests, so a cached per-user feed would
 * hand one student's notifications to another. The Nav that renders the bell
 * reads the session via auth(), so the page is dynamic anyway.
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
    return {
      id: r.id,
      type: r.type,
      read: r.readAt !== null,
      href: notificationHref(r.type, r.eventId, r.event?.status === "PUBLISHED"),
      title: r.event?.title ?? null,
      club: r.event?.club?.name ?? null,
      dedupeKey: r.dedupeKey,
      timeLabel: formatDateTime(r.createdAt, locale),
    };
  });

  return { unreadCount, items };
}
