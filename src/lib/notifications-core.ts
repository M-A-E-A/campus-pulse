import { prisma } from "@/lib/prisma";
import type { Prisma, NotificationType } from "@prisma/client";

/**
 * Notification creation, deliberately free of Next.js request context
 * (no auth(), no revalidatePath) exactly like rsvp-core.ts, so it can be
 * unit-tested directly. The server actions in src/lib/actions/ add auth and
 * cache invalidation around these.
 *
 * WHY rows store a type and not a sentence: the app is trilingual (fr/en/ar).
 * A stored English string would be wrong for most readers, so the message is
 * built at read time in the viewer's locale (src/components/notifications/),
 * and the event title is pulled through the relation. Nothing in this module
 * needs to know what language anyone reads.
 *
 * WHY every row carries a dedupeKey: Postgres enforces (userId, eventId,
 * dedupeKey) as a unique index, so createMany + skipDuplicates makes each
 * trigger idempotent. A re-run of the reminder cron, or an organizer clicking
 * cancel twice, can never double-notify anyone. A NULL key wouldn't conflict
 * (SQL treats NULLs as distinct), which is why the key is always set.
 */
type Db = Prisma.TransactionClient;

type Row = {
  userId: string;
  type: NotificationType;
  eventId: string;
  dedupeKey: string;
};

/**
 * What a fan-out did, for its two different audiences:
 *   created — rows that actually landed (0 on a repeat run: the unique index
 *             swallowed them). The reminder cron reports this sum, so it keeps
 *             its "how much work happened" meaning.
 *   userIds — everyone the trigger targeted, landed or not. The push
 *             dispatcher takes this set and is itself idempotent (it only
 *             sends rows with pushedAt still NULL), so passing the full target
 *             set through is safe even on a no-op run.
 */
export type Fanout = { created: number; userIds: string[] };

/** Insert a batch; re-inserting identical rows is a no-op, not a duplicate. */
async function insertMany(db: Db, rows: Row[]): Promise<Fanout> {
  const userIds = [...new Set(rows.map((r) => r.userId))];
  if (rows.length === 0) return { created: 0, userIds };
  const created = await db.notification.createMany({ data: rows, skipDuplicates: true });
  return { created: created.count, userIds };
}

/**
 * A student climbed off the waitlist onto a real seat.
 *
 * Called from INSIDE performCancelRsvp's locked transaction with that
 * transaction's client, so the promotion and its notification commit or roll
 * back together — a rolled-back promotion can never tell someone they got in.
 * The dedupe key keeps this to one "you got a seat" per student per event
 * even if the seat later churns again.
 */
export async function notifyWaitlistPromoted(
  db: Db,
  userId: string,
  eventId: string
): Promise<void> {
  await insertMany(db, [{ userId, type: "WAITLIST_PROMOTED", eventId, dedupeKey: "promoted" }]);
}

/**
 * The organizer cancelled an event: tell everyone whose plan it was —
 * confirmed seat holders AND waitlisted students, since a queue spot is still
 * a plan somebody made.
 */
export async function notifyEventCancelled(eventId: string): Promise<Fanout> {
  const attendees = await prisma.rsvp.findMany({
    where: { eventId, status: { in: ["CONFIRMED", "WAITLISTED"] } },
    select: { userId: true },
  });
  return insertMany(
    prisma,
    attendees.map((a) => ({
      userId: a.userId,
      type: "EVENT_CANCELLED" as const,
      eventId,
      dedupeKey: "cancelled",
    }))
  );
}

/**
 * An admin approved a pending event: tell every follower of its club that
 * something they asked to hear about is now live.
 */
export async function notifyClubFollowers(clubId: string, eventId: string): Promise<Fanout> {
  const followers = await prisma.follow.findMany({
    where: { clubId },
    select: { userId: true },
  });
  return insertMany(
    prisma,
    followers.map((f) => ({
      userId: f.userId,
      type: "NEW_CLUB_EVENT" as const,
      eventId,
      dedupeKey: "new-event",
    }))
  );
}

/**
 * One pass of the reminder cron for a single event. `slot` names the window
 * ("24h" / "1h") and lands in the dedupe key, so each slot fires exactly once
 * per attendee however many times the job runs.
 *
 * Only CONFIRMED attendees are reminded — a waitlisted student has no seat to
 * show up for yet.
 */
export async function createEventReminders(
  eventId: string,
  slot: "24h" | "1h"
): Promise<Fanout> {
  const attendees = await prisma.rsvp.findMany({
    where: { eventId, status: "CONFIRMED" },
    select: { userId: true },
  });
  return insertMany(
    prisma,
    attendees.map((a) => ({
      userId: a.userId,
      type: "EVENT_REMINDER" as const,
      eventId,
      dedupeKey: `reminder:${slot}`,
    }))
  );
}
