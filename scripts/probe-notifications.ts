/**
 * Phase 1 verification — in-app notifications.
 *
 * Run: node --import tsx scripts/probe-notifications.ts   (server on :3100,
 * CRON_SECRET exported on the server for the two HTTP checks)
 *
 * What it proves, in order:
 *   1. a waitlist promotion INSIDE performCancelRsvp's transaction leaves a
 *      WAITLIST_PROMOTED row for the promoted student — and nobody else
 *   2. re-running that promotion cannot double-notify (dedupe key)
 *   3. the reminder cron routes correctly, builds a real reminder for a
 *      CONFIRMED attendee, and is idempotent on the second call
 *   4. the event-cancelled fan-out reaches attendees exactly once
 *   5. the club-published fan-out reaches followers exactly once
 *
 * Everything it creates is deleted again, and it only ever touches rows that
 * reference its own throwaway event id, so seed data is left alone.
 */
import { prisma } from "../src/lib/prisma";
import { performRsvp, performCancelRsvp } from "../src/lib/rsvp-core";
import {
  notifyWaitlistPromoted,
  notifyEventCancelled,
  notifyClubFollowers,
} from "../src/lib/notifications-core";

const CRON = "http://localhost:3100/api/cron/reminders";
const SECRET = process.env.CRON_SECRET ?? "";

let failures = 0;
function check(name: string, cond: boolean, detail: string) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!cond) failures++;
}

async function cronCall(): Promise<{ status: number; body: { ok?: boolean; created?: Record<string, number> } }> {
  const res = await fetch(CRON, { headers: { Authorization: `Bearer ${SECRET}` } });
  return { status: res.status, body: await res.json() };
}

async function main() {
  const student = await prisma.user.findUnique({ where: { email: "student@campus.ma" } });
  const other = await prisma.user.findUnique({ where: { email: "flow-tester@campus.ma" } });
  const club = await prisma.club.findFirst({ orderBy: { name: "asc" } });
  const category = await prisma.category.findFirst({ orderBy: { name: "asc" } });
  if (!student || !other || !club || !category) {
    throw new Error("seed data missing — run `npm run db:seed` first");
  }

  // +30 min keeps the event inside the cron's 1h window and outside its 24h
  // window, so the reminder check has a precise expectation.
  const event = await prisma.event.create({
    data: {
      title: "Notifications probe (temporary)",
      description: "Throwaway fixture created by scripts/probe-notifications.ts",
      location: "Probe room",
      startsAt: new Date(Date.now() + 30 * 60_000),
      endsAt: new Date(Date.now() + 90 * 60_000),
      capacity: 1,
      status: "PUBLISHED",
      clubId: club.id,
      categoryId: category.id,
    },
  });
  const eid = event.id;

  // Only touch our own fixture from here on.
  const mine = { eventId: eid };

  let createdFollow = false;
  try {
    console.log(`fixture event ${eid}, club ${club.name}\n`);

    // --- capacity 1: A takes the seat, B is waitlisted --------------------
    const a1 = await performRsvp(student.id, eid);
    check("A takes the only seat", a1.ok && a1.messageKey === "detail.rsvp.done", a1.messageKey);

    const b1 = await performRsvp(other.id, eid);
    check("B lands on the waitlist", b1.ok && b1.messageKey === "detail.rsvp.waitlisted", b1.messageKey);

    const before = await prisma.notification.count({ where: mine });
    check("no notifications before promotion", before === 0, `count=${before}`);

    // --- A cancels: B is promoted inside the same locked transaction ------
    const cancel = await performCancelRsvp(student.id, eid);
    check("A's cancel succeeds", cancel.ok, cancel.messageKey);

    const promoted = await prisma.notification.findMany({
      where: { ...mine, userId: other.id, type: "WAITLIST_PROMOTED" },
    });
    check(
      "promotion leaves exactly one notification for B",
      promoted.length === 1,
      `rows=${promoted.length}`
    );
    check(
      "row carries the dedupe key",
      promoted[0]?.dedupeKey === "promoted",
      `dedupeKey=${promoted[0]?.dedupeKey}`
    );
    check("row is unread", promoted[0]?.readAt === null, `readAt=${promoted[0]?.readAt}`);

    const bRsvp = await prisma.rsvp.findUnique({
      where: { userId_eventId: { userId: other.id, eventId: eid } },
    });
    check("B actually holds a seat", bRsvp?.status === "CONFIRMED", `status=${bRsvp?.status}`);

    const aRows = await prisma.notification.count({
      where: { ...mine, userId: student.id, type: "WAITLIST_PROMOTED" },
    });
    check("the student who cancelled got nothing", aRows === 0, `rows=${aRows}`);

    // --- dedupe: re-running the promotion is a no-op ----------------------
    await notifyWaitlistPromoted(prisma, other.id, eid);
    const afterRepeat = await prisma.notification.count({
      where: { ...mine, type: "WAITLIST_PROMOTED" },
    });
    check("repeat promotion cannot double-notify", afterRepeat === 1, `rows=${afterRepeat}`);

    // --- reminder cron over HTTP: routes, window, dedupe ------------------
    if (!SECRET) {
      check("cron secret exported", false, "set CRON_SECRET in this shell to run the HTTP checks");
    } else {
      const first = await cronCall();
      check("cron accepts the secret", first.status === 200 && first.body.ok === true, `status=${first.status}`);
      check(
        "first run creates the 1h reminder",
        (first.body.created?.["1h"] ?? 0) >= 1,
        `created=${JSON.stringify(first.body.created)}`
      );

      const reminders = await prisma.notification.findMany({
        where: { ...mine, userId: other.id, type: "EVENT_REMINDER" },
      });
      check(
        "B has a real 1h reminder row",
        reminders.length === 1 && reminders[0].dedupeKey === "reminder:1h",
        `rows=${reminders.length}, key=${reminders[0]?.dedupeKey}`
      );

      const second = await cronCall();
      const created = second.body.created ?? {};
      check(
        "second run is fully idempotent",
        (created["24h"] ?? 0) === 0 && (created["1h"] ?? 0) === 0,
        `created=${JSON.stringify(created)}`
      );
    }

    // --- cancelled-event fan-out ----------------------------------------
    const c1 = await notifyEventCancelled(eid);
    check("cancellation reaches attendees", c1.created >= 1, `created=${c1.created}`);
    const c2 = await notifyEventCancelled(eid);
    check("repeat cancellation creates nothing", c2.created === 0, `created=${c2.created}`);

    // --- club-published fan-out ------------------------------------------
    const already = await prisma.follow.findUnique({
      where: { userId_clubId: { userId: other.id, clubId: club.id } },
    });
    if (!already) {
      await prisma.follow.create({ data: { userId: other.id, clubId: club.id } });
      createdFollow = true;
    }
    const f1 = await notifyClubFollowers(club.id, eid);
    check("followers hear about a new event", f1.created >= 1, `created=${f1.created}`);
    const f2 = await notifyClubFollowers(club.id, eid);
    check("repeat publish fan-out creates nothing", f2.created === 0, `created=${f2.created}`);
  } finally {
    // Notifications first: deleting the event would otherwise SET their
    // eventId to NULL (SetNull) and leave rows behind.
    await prisma.notification.deleteMany({ where: mine });
    await prisma.event.delete({ where: { id: eid } }).catch(() => undefined);
    if (createdFollow) {
      await prisma.follow.deleteMany({ where: { userId: other.id, clubId: club.id } });
    }
  }
}

main()
  .catch((err) => {
    console.error("PROBE ERROR:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    console.log(`\nTOTAL: ${failures === 0 ? "all passed" : `${failures} failed`}`);
    if (failures > 0) process.exitCode = 1;
    return prisma.$disconnect();
  });
