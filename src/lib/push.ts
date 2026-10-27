import { createHash } from "node:crypto";
import { sendNotification, setVapidDetails } from "web-push";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { prisma } from "@/lib/prisma";
import { LOCALE_DIRS, isLocale, translate, type Locale } from "@/i18n/core";
import { en, fr, ar, type FullDict, type T } from "@/i18n/index";
import { notificationMessage } from "@/lib/notification-message";
import { notificationHref } from "@/lib/notifications-query";
import type { Prisma, PushSubscription } from "@prisma/client";

/**
 * Web push: the second delivery channel for the same Notification rows the
 * bell shows. Same read-time rule — rows still store a type, and the sentence
 * is rendered per device in the locale captured at subscribe time (a push has
 * no request to read a cookie from).
 *
 * Everything in here is best-effort by construction: dispatchPushes never
 * throws, a push-service outage never fails the server action that triggered
 * it, and a failed send simply leaves pushedAt NULL so the next dispatch
 * retries instead of losing the message.
 */

/** VAPID config from .env. Generated once by `npx web-push generate-vapid-keys`. */
function vapidConfig(): { subject: string; publicKey: string; privateKey: string } | null {
  const subject = process.env.PUSH_VAPID_SUBJECT;
  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

/** The public half — served to the browser by GET /api/push/public-key. */
export function pushPublicKey(): string | null {
  return vapidConfig()?.publicKey ?? null;
}

const DICTS: Record<Locale, FullDict> = { en, fr, ar };

type PendingRow = Prisma.NotificationGetPayload<{
  include: { event: { select: { title: true; status: true, club: { select: { name: true } } } } };
}>;

export type DispatchSummary = {
  /** Pushes the push service accepted (HTTP 2xx). */
  sent: number;
  /** Subscriptions the push service retired (404/410) and we deleted. */
  dropped: number;
  /** Sends that failed for any other reason — the rows stay owed (pushedAt NULL). */
  failed: number;
};

/**
 * Hand each user's unread, not-yet-pushed rows to their subscribed devices.
 *
 * Only the NEWEST owed row is sent per user: a push means "something just
 * happened", and once a newer thing happened the older ones are superseded —
 * the bell keeps the full history, pushedAt only tracks this channel. On the
 * rare burst (rows created while no device was reachable), one send still
 * marks the whole burst as handled so retries can never become spam.
 *
 * `userIds` may contain users with nothing owed and users with no
 * subscription: both fall through as cheap no-ops, which is why every trigger
 * can pass its full fan-out target set without filtering.
 */
export async function dispatchPushes(userIds: string[]): Promise<DispatchSummary> {
  const summary: DispatchSummary = { sent: 0, dropped: 0, failed: 0 };
  try {
    const unique = [...new Set(userIds)].filter(Boolean);
    const vapid = vapidConfig();
    if (unique.length === 0 || !vapid) return summary;

    const [pending, subs] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: { in: unique }, readAt: null, pushedAt: null },
        orderBy: { createdAt: "desc" }, // first row per user is that user's newest
        include: {
          event: { select: { title: true, status: true, club: { select: { name: true } } } },
        },
      }),
      prisma.pushSubscription.findMany({ where: { userId: { in: unique } } }),
    ]);
    if (pending.length === 0 || subs.length === 0) return summary;

    setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    // Newest owed row per user, plus the full owed-id set to mark superseded.
    const newest = new Map<string, PendingRow>();
    const owedIds = new Map<string, string[]>();
    for (const row of pending) {
      if (!newest.has(row.userId)) newest.set(row.userId, row);
      owedIds.set(row.userId, [...(owedIds.get(row.userId) ?? []), row.id]);
    }
    const subsByUser = new Map<string, PushSubscription[]>();
    for (const sub of subs) {
      subsByUser.set(sub.userId, [...(subsByUser.get(sub.userId) ?? []), sub]);
    }

    for (const [userId, row] of newest) {
      const mySubs = subsByUser.get(userId);
      // No device switched push on (yet): the rows stay owed, not lost —
      // they're pushed the next time this user's device subscribes and a new
      // dispatch runs, and the bell shows them meanwhile.
      if (!mySubs?.length) continue;

      let accepted = false;
      for (const sub of mySubs) {
        const outcome = await sendOne(vapid, sub, row);
        if (outcome === "gone") {
          // 404/410: the push service no longer knows this endpoint (browser
          // expired it, profile deleted). Prune instead of failing forever.
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => undefined);
          summary.dropped++;
        } else if (outcome === "accepted") {
          accepted = true;
          summary.sent++;
        } else {
          summary.failed++;
        }
      }

      if (accepted) {
        await prisma.notification.updateMany({
          where: { id: { in: owedIds.get(userId) ?? [] }, pushedAt: null },
          data: { pushedAt: new Date() },
        });
      }
    }
  } catch {
    // Never rethrow: callers are server actions/cron, and a push outage must
    // not fail the cancellation or approval that triggered it. Rows stay owed.
  }
  return summary;
}

type Vapid = NonNullable<ReturnType<typeof vapidConfig>>;

async function sendOne(
  vapid: Vapid,
  sub: PushSubscription,
  row: PendingRow
): Promise<"accepted" | "gone" | "failed"> {
  const locale: Locale = isLocale(sub.locale) ? sub.locale : "fr";
  const t: T = (key, vars) => translate(DICTS[locale], key, vars);
  const published = row.event?.status === "PUBLISHED";
  const href = notificationHref(row.type, row.eventId, published);

  const payload = JSON.stringify({
    title: "Campus Pulse",
    body: notificationMessage(t, {
      type: row.type,
      dedupeKey: row.dedupeKey,
      title: row.event?.title ?? null,
      club: row.event?.club?.name ?? null,
    }),
    // No href means its event was deleted: land where the student still is.
    url: href ?? "/dashboard",
    lang: locale,
    dir: LOCALE_DIRS[locale],
    // Same type+event collapses on the device (a re-reminder replaces itself).
    tag: `${row.type}:${row.eventId ?? row.id}`,
  });

  const subscription: WebPushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };

  try {
    await sendNotification(subscription, payload, {
      vapidDetails: vapid,
      TTL: 6 * 3600, // a stale "starting soon" hours later is worse than nothing
      urgency: "normal",
      // 6h too: an expired queued push should not surface later, and the
      // topic lets the push service replace a queued copy of the same
      // event+type instead of delivering both. Base64url, ≤32 chars (hash it:
      // a raw type:eventId would violate both limits and 400 the request).
      topic: createHash("sha1")
        .update(`${row.type}:${row.eventId ?? row.id}`)
        .digest("base64url")
        .slice(0, 32),
      timeout: 8_000, // bound the socket so a wedged push service can't hang a dispatch
    });
    return "accepted";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}
