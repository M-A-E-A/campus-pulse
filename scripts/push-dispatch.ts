/**
 * Server half of the push end-to-end (run by scripts/probe-pwa.mjs while the
 * freshly-subscribed browser is STILL OPEN — the endpoint only accepts a push
 * while that browser session holds the subscription).
 *
 * Proves, against the real push service (not a mock):
 *   1. the subscription row the browser created via the UI exists,
 *   2. dispatchPushes() encrypts + hands the payload over and gets a 2xx,
 *   3. the owed row's pushedAt gets stamped (the "push channel done" marker),
 *   4. a second dispatch sends nothing — the idempotency the cron relies on.
 *
 * Leaves the DB clean: the test notification and the test subscription are
 * removed either way. Output: the last line is `RESULT {...json...}`.
 *
 * Usage: node --import tsx scripts/push-dispatch.ts
 */
import { prisma } from "../src/lib/prisma";
import { dispatchPushes } from "../src/lib/push";

async function main() {
  const student = await prisma.user.findUnique({
    where: { email: "student@campus.ma" },
    select: { id: true },
  });
  if (!student) throw new Error("student@campus.ma not found — seed first");

  const subsBefore = await prisma.pushSubscription.count({ where: { userId: student.id } });
  if (subsBefore === 0) {
    console.log(
      `RESULT ${JSON.stringify({ ok: false, reason: "no subscription row — the browser half never subscribed", subsBefore })}`
    );
    return;
  }

  // A published event makes the payload a realistic sentence; any will do.
  const event = await prisma.event.findFirst({
    where: { status: "PUBLISHED" },
    select: { id: true },
  });
  if (!event) {
    console.log(`RESULT ${JSON.stringify({ ok: false, reason: "no PUBLISHED event to build a message from" })}`);
    return;
  }

  const row = await prisma.notification.create({
    data: {
      userId: student.id,
      type: "WAITLIST_PROMOTED",
      eventId: event.id,
      dedupeKey: "push-e2e-test", // unique vs. real "promoted" rows — never collides
      readAt: null,
      pushedAt: null,
    },
  });

  try {
    const first = await dispatchPushes([student.id]);
    const afterFirst = await prisma.notification.findUnique({
      where: { id: row.id },
      select: { pushedAt: true },
    });
    const second = await dispatchPushes([student.id]); // must send nothing

    console.log(
      `RESULT ${JSON.stringify({
        ok: first.sent >= 1 && afterFirst?.pushedAt !== null && second.sent === 0,
        subsBefore,
        first,
        pushedAt: afterFirst?.pushedAt ? afterFirst.pushedAt.toISOString() : null,
        second,
      })}`
    );
  } finally {
    await prisma.notification.delete({ where: { id: row.id } }).catch(() => undefined);
    // The test subscription would outlive the probe's browser (its endpoint
    // 404s once the throwaway profile dies) — delete it now rather than
    // leaving a row that only a later dispatch would discover is dead.
    await prisma.pushSubscription.deleteMany({ where: { userId: student.id } });
  }
}

main()
  .catch((err) => {
    console.log(`RESULT ${JSON.stringify({ ok: false, error: String(err?.message || err) })}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
