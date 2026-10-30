// Dev/test helper: close the door again — clear every check-in on an event.
// Used by probe-pulse.mjs so the door-rush simulation starts from zero and
// stays re-runnable (the check-in is idempotent per RSVP, so a second run
// against a checked-in event would tick nothing).
// Usage: node --import tsx scripts/reset-checkins.ts <eventId>
import { prisma } from "../src/lib/prisma";

async function main() {
  const [eventId] = process.argv.slice(2);
  if (!eventId) {
    console.error("usage: reset-checkins.ts <eventId>");
    process.exit(2);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });
  if (!event) {
    console.error(`no such event: ${eventId}`);
    process.exit(1);
  }

  const { count } = await prisma.rsvp.updateMany({
    where: { eventId, checkedInAt: { not: null } },
    data: { checkedInAt: null },
  });
  console.log(`${event.id}: ${count} check-in(s) cleared`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
