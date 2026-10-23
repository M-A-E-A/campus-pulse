// Dev helper: delete an event row (no delete UI exists on purpose —
// events are cancelled, not erased — but throwaway test events need a way out).
// Usage: node --import tsx scripts/delete-event.ts <eventId>
import { prisma } from "../src/lib/prisma";

async function main() {
  const [eventId] = process.argv.slice(2);
  if (!eventId) {
    console.error("usage: delete-event.ts <eventId>");
    process.exit(2);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, _count: { select: { rsvps: true } } },
  });
  if (!event) {
    console.error(`no such event: ${eventId}`);
    process.exit(1);
  }

  await prisma.event.delete({ where: { id: eventId } });
  console.log(`deleted "${event.title}" (${event._count.rsvps} rsvp rows removed)`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
