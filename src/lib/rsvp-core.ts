import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import type { DictKey } from "@/i18n";

/**
 * Core RSVP / check-in logic, deliberately free of Next.js request context
 * (no auth(), no revalidatePath) so it can be unit-tested directly.
 * The server actions in src/lib/actions/ add auth + cache invalidation.
 *
 * Results carry a dictionary KEY, not a sentence: server actions translate
 * with getT() before returning to the client, and the race test asserts on
 * stable keys instead of English prose.
 */

export type RsvpResult = { ok: boolean; messageKey: DictKey };

export type CheckInResult =
  | { status: "ok"; name: string }
  | { status: "duplicate"; name: string }
  | { status: "invalid" }
  | { status: "cancelled" }
  /** Holds a queue spot, not a ticket: never admittable at the door.
   *  (CheckInScanner.tsx compares against known statuses only, so an
   *  unmapped status simply renders no banner text — safe to add here.) */
  | { status: "waitlisted"; name: string };

/**
 * RSVP to an event.
 *
 * The capacity check and the insert run inside one transaction, and the
 * event row is locked with SELECT ... FOR UPDATE so two students racing for
 * the last spot are serialized: the second sees the first one's row and
 * never oversells.
 *
 * When the event is full the student is WAITLISTED instead of turned away:
 * the waitlist row is created inside the same locked transaction, and a
 * cancelled attendee's spot is promoted to the earliest waitlisted student
 * in performCancelRsvp (same lock), so promotion can't race a fresh RSVP.
 *
 * The unique constraint on (userId, eventId) is the second line of defense —
 * a duplicate RSVP fails at the database no matter what the app does.
 */
export async function performRsvp(userId: string, eventId: string): Promise<RsvpResult> {
  // Outcomes that must COMMIT (done / waitlisted) are returned from the
  // transaction; only failure paths throw, which rolls back.
  let messageKey: DictKey = "detail.rsvp.done";
  try {
    messageKey = await prisma.$transaction(async (tx): Promise<DictKey> => {
      // Lock the event row for the duration of the transaction.
      const rows = await tx.$queryRaw<{ id: string; capacity: number | null; status: string }[]>`
        SELECT id, capacity, status FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

      const event = rows[0];
      if (!event) throw new Error("NOT_FOUND");
      if (event.status !== "PUBLISHED") throw new Error("NOT_OPEN");

      // Already going? Idempotent no-op — keeps the existing ticket code.
      const existing = await tx.rsvp.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      if (existing && existing.status === "CONFIRMED") throw new Error("ALREADY");
      // Already queued? Idempotent no-op — keeps their place in line.
      if (existing && existing.status === "WAITLISTED") throw new Error("ALREADY_WAITLISTED");

      if (event.capacity !== null) {
        // Capacity counts CONFIRMED only — waitlisted rows aren't seats.
        const taken = await tx.rsvp.count({
          where: { eventId, status: "CONFIRMED" },
        });
        if (taken >= event.capacity) {
          // Full: join the waitlist instead of failing. The ticket code is
          // generated now, so promotion later needs no new code.
          if (existing) {
            // Re-RSVP after a cancel while full: same row, back to the queue.
            await tx.rsvp.update({
              where: { id: existing.id },
              data: { status: "WAITLISTED", checkedInAt: null },
            });
          } else {
            await tx.rsvp.create({
              data: {
                userId,
                eventId,
                status: "WAITLISTED",
                ticketCode: randomBytes(16).toString("hex"),
              },
            });
          }
          return "detail.rsvp.waitlisted";
        }
      }

      if (existing) {
        // Re-RSVP after a cancel: flip the existing row back to CONFIRMED.
        // Never insert a second row — the unique constraint would reject it.
        await tx.rsvp.update({
          where: { id: existing.id },
          data: { status: "CONFIRMED", checkedInAt: null },
        });
      } else {
        await tx.rsvp.create({
          data: {
            userId,
            eventId,
            status: "CONFIRMED",
            // 128 bits of randomness — unguessable ticket code.
            ticketCode: randomBytes(16).toString("hex"),
          },
        });
      }
      return "detail.rsvp.done";
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ALREADY") return { ok: true, messageKey: "detail.rsvp.alreadyGoing" };
    if (code === "ALREADY_WAITLISTED")
      return { ok: true, messageKey: "detail.rsvp.alreadyWaitlisted" };
    if (code === "NOT_FOUND") return { ok: false, messageKey: "detail.rsvp.notFound" };
    if (code === "NOT_OPEN") return { ok: false, messageKey: "detail.rsvp.closed" };
    // P2002 = unique constraint (userId, eventId) raced past our check.
    if (code.includes("P2002")) return { ok: false, messageKey: "detail.rsvp.alreadyDone" };
    console.error("RSVP failed:", error);
    return { ok: false, messageKey: "detail.rsvp.error" };
  }

  return { ok: true, messageKey };
}

/**
 * Cancel an RSVP (CONFIRMED or WAITLISTED). The row stays (status =
 * CANCELLED) so the unique constraint still holds.
 *
 * Side effect: when a CONFIRMED attendee gives up their seat, the EARLIEST
 * waitlisted student is promoted to CONFIRMED in the same transaction,
 * keeping their ticket code (update — never insert: the unique constraint
 * on (userId, eventId)). The event row is locked with SELECT ... FOR UPDATE
 * exactly like performRsvp, so the promotion can't race a fresh RSVP for
 * the freed seat. The promotion is silent: the promoted student finds the
 * ticket on their dashboard.
 */
export async function performCancelRsvp(userId: string, eventId: string): Promise<RsvpResult> {
  await prisma.$transaction(async (tx) => {
    // Same lock as performRsvp: serialize against RSVPs for this event.
    const rows = await tx.$queryRaw<{ capacity: number | null }[]>`
      SELECT capacity FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

    const mine = await tx.rsvp.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (!mine || (mine.status !== "CONFIRMED" && mine.status !== "WAITLISTED")) return;
    const freedASeat = mine.status === "CONFIRMED";

    await tx.rsvp.updateMany({
      where: { id: mine.id, status: { in: ["CONFIRMED", "WAITLISTED"] } },
      data: { status: "CANCELLED", checkedInAt: null },
    });

    if (!freedASeat) return; // leaving the waitlist never frees a seat.

    // Hand the freed seat to the earliest waitlisted student, but only if
    // the event can actually hold them (capacity === null means unlimited).
    const capacity = rows[0]?.capacity ?? null;
    const confirmed = await tx.rsvp.count({ where: { eventId, status: "CONFIRMED" } });
    if (capacity !== null && confirmed >= capacity) return;

    const next = await tx.rsvp.findFirst({
      where: { eventId, status: "WAITLISTED" },
      orderBy: { createdAt: "asc" }, // FIFO: earliest spot in line first
    });
    if (!next) return;

    await tx.rsvp.update({
      where: { id: next.id },
      data: { status: "CONFIRMED", checkedInAt: null }, // keeps its ticketCode
    });
  });
  return { ok: true, messageKey: "detail.rsvp.cancelled" };
}

/**
 * Position in the waitlist queue: how many WAITLISTED rsvps were created
 * strictly before this row, plus one (1 = next in line). Counts only the
 * queue — a confirmed seat holder isn't "ahead of you in the queue", they
 * hold a seat; this number matches the FIFO order performCancelRsvp
 * promotes in.
 */
export async function getWaitlistRank(eventId: string, rsvpCreatedAt: Date): Promise<number> {
  const ahead = await prisma.rsvp.count({
    where: {
      eventId,
      status: "WAITLISTED",
      createdAt: { lt: rsvpCreatedAt },
    },
  });
  return ahead + 1;
}

/**
 * Mark a ticket as checked in.
 *
 * Idempotent by design: the UPDATE only fires while checkedInAt is still
 * null, so scanning the same ticket twice returns "duplicate" instead of
 * counting the student twice. Callers must do authorization separately.
 */
export async function performCheckIn(
  eventId: string,
  ticketCode: string
): Promise<CheckInResult> {
  const code = ticketCode.trim().toLowerCase();

  const rsvp = await prisma.rsvp.findFirst({
    where: { ticketCode: code, eventId },
    include: { user: { select: { name: true } } },
  });
  if (!rsvp) return { status: "invalid" };
  if (rsvp.status === "CANCELLED") return { status: "cancelled" };
  // A waitlisted student holds a queue spot, not a ticket — never admittable.
  if (rsvp.status === "WAITLISTED") return { status: "waitlisted", name: rsvp.user.name };

  const updated = await prisma.rsvp.updateMany({
    where: { id: rsvp.id, checkedInAt: null },
    data: { checkedInAt: new Date() },
  });

  return updated.count === 1
    ? { status: "ok", name: rsvp.user.name }
    : { status: "duplicate", name: rsvp.user.name };
}
