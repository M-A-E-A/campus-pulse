// Dev/test helper: flip an event's status directly.
// Used by the smoke test to stage a pending event in the admin queue so the
// test does not depend on whatever state the demo data happens to be in.
// Usage: node --import tsx scripts/set-event-status.ts <eventId> <STATUS>
import { prisma } from "../src/lib/prisma";

const STATUSES = ["DRAFT", "PENDING", "PUBLISHED", "REJECTED", "CANCELLED"] as const;

async function main() {
  const [eventId, statusArg] = process.argv.slice(2);

  if (!eventId || !statusArg || !(STATUSES as readonly string[]).includes(statusArg)) {
    console.error(`usage: set-event-status.ts <eventId> <${STATUSES.join("|")}>`);
    process.exit(2);
  }
  const status: (typeof STATUSES)[number] = statusArg as (typeof STATUSES)[number];

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, status: true },
  });
  if (!event) {
    console.error(`no such event: ${eventId}`);
    process.exit(1);
  }

  await prisma.event.update({ where: { id: eventId }, data: { status } });
  console.log(`${event.id}: ${event.status} -> ${status}`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
