/**
 * Stage a set of demo notifications for the seeded student so the bell can be
 * judged with real content (unread badge, message variants, read vs unread
 * rows). Run scripts/clear-notifications.ts afterwards to remove them again.
 *
 * Usage: node --import tsx scripts/stage-notifications.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const student = await prisma.user.findUnique({ where: { email: "student@campus.ma" } });
  if (!student) throw new Error("student@campus.ma missing — run `npm run db:seed`");

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { startsAt: "asc" },
    take: 5,
    select: { id: true, title: true, club: { select: { name: true } } },
  });
  if (events.length < 5) throw new Error(`need 5 published events, found ${events.length}`);

  await prisma.notification.deleteMany({ where: { userId: student.id } });

  const rows = [
    { type: "WAITLIST_PROMOTED" as const, eventId: events[0].id, dedupeKey: "promoted", readAt: null },
    { type: "EVENT_REMINDER" as const, eventId: events[1].id, dedupeKey: "reminder:1h", readAt: null },
    { type: "EVENT_REMINDER" as const, eventId: events[2].id, dedupeKey: "reminder:24h", readAt: null },
    { type: "NEW_CLUB_EVENT" as const, eventId: events[3].id, dedupeKey: "new-event", readAt: new Date(Date.now() - 3_600_000) },
    { type: "EVENT_CANCELLED" as const, eventId: events[4].id, dedupeKey: "cancelled", readAt: new Date(Date.now() - 7_200_000) },
  ];
  await prisma.notification.createMany({ data: rows.map((r) => ({ ...r, userId: student.id })) });

  console.log(`staged ${rows.length} notifications (3 unread) for ${student.email}:`);
  events.forEach((e, i) => console.log(`  ${rows[i].type.padEnd(18)} <- ${e.title} (${e.club.name})`));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await prisma.$disconnect();
});
