// Direct tests of the RSVP transaction + check-in idempotency.
// Run: npx tsx scripts/test-rsvp-race.ts
import { PrismaClient } from "@prisma/client";
import {
  performRsvp,
  performCancelRsvp,
  performCheckIn,
  getWaitlistRank,
} from "../src/lib/rsvp-core";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("— RSVP race condition (capacity = 1) —");

  const category = await prisma.category.findFirstOrThrow();
  const userA = await prisma.user.create({
    data: { name: "Race A", email: `race-a-${Date.now()}@test.dev`, passwordHash: "x" },
  });
  const userB = await prisma.user.create({
    data: { name: "Race B", email: `race-b-${Date.now()}@test.dev`, passwordHash: "x" },
  });
  const event = await prisma.event.create({
    data: {
      title: "Race test (capacity 1)",
      description: "Temporary event for concurrency testing.",
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 90_000_000),
      location: "Test room",
      capacity: 1,
      status: "PUBLISHED",
      clubId: (await prisma.club.findFirstOrThrow()).id,
      categoryId: category.id,
    },
  });

  // Fire both RSVPs at the same moment — the oversell scenario.
  // With waitlisting both calls "succeed": one lands CONFIRMED, the other
  // joins the queue. What must never happen is two CONFIRMED seats.
  const [ra, rb] = await Promise.all([
    performRsvp(userA.id, event.id),
    performRsvp(userB.id, event.id),
  ]);

  check("both RSVP calls return ok", ra.ok && rb.ok, `${ra.messageKey} / ${rb.messageKey}`);
  const keys = [ra.messageKey, rb.messageKey].sort();
  check(
    "one 'done', one 'waitlisted'",
    keys[0] === "detail.rsvp.done" && keys[1] === "detail.rsvp.waitlisted",
    keys.join(" / ")
  );

  const rowsAfterRace = await prisma.rsvp.findMany({ where: { eventId: event.id } });
  const confirmedCount = rowsAfterRace.filter((r) => r.status === "CONFIRMED").length;
  const waitlistedCount = rowsAfterRace.filter((r) => r.status === "WAITLISTED").length;
  check("exactly one CONFIRMED (no oversell)", confirmedCount === 1, `got ${confirmedCount}`);
  check("the other lands on the waitlist", waitlistedCount === 1, `got ${waitlistedCount}`);

  // Identify the winner/loser from the database, not from race timing.
  const winnerRow = rowsAfterRace.find((r) => r.status === "CONFIRMED");
  const loserRow = rowsAfterRace.find((r) => r.status === "WAITLISTED");
  if (!winnerRow || !loserRow) throw new Error("race produced no winner/loser pair");
  const winner = winnerRow.userId === userA.id ? userA : userB;
  const loser = loserRow.userId === userA.id ? userA : userB;
  const loserCodeBefore = loserRow.ticketCode;

  console.log("— Second RSVP for the same user (unique constraint) —");
  const again = await performRsvp(winner.id, event.id);
  check("re-RSVP is a friendly no-op", again.ok && again.messageKey.includes("already"), again.messageKey);

  const againWaitlisted = await performRsvp(loser.id, event.id);
  check(
    "re-RSVP while waitlisted is a no-op (keeps the queue spot)",
    againWaitlisted.ok && againWaitlisted.messageKey === "detail.rsvp.alreadyWaitlisted",
    againWaitlisted.messageKey
  );

  // Bypass the app entirely: a raw duplicate insert must be rejected by Postgres.
  let p2002 = false;
  try {
    await prisma.rsvp.create({
      data: { userId: winner.id, eventId: event.id, ticketCode: "forced-duplicate" },
    });
  } catch (e) {
    p2002 = (e as { code?: string }).code === "P2002";
  }
  check("unique (userId, eventId) rejects duplicate row", p2002);

  console.log("— Cancel promotes the waitlisted student —");
  await performCancelRsvp(winner.id, event.id);
  const loserAfter = await prisma.rsvp.findUniqueOrThrow({ where: { id: loserRow.id } });
  check("cancel hands the seat to the waitlisted student", loserAfter.status === "CONFIRMED", loserAfter.status);
  check("promotion keeps the same ticket code", loserAfter.ticketCode === loserCodeBefore);

  // The freed seat is gone again — the ex-winner now queues up.
  const reRsvp = await performRsvp(winner.id, event.id);
  check(
    "re-RSVP after cancel joins the waitlist (event full again)",
    reRsvp.ok && reRsvp.messageKey === "detail.rsvp.waitlisted",
    reRsvp.messageKey
  );
  const rowsAfter = await prisma.rsvp.count({ where: { eventId: event.id, userId: winner.id } });
  check("still only one row for the user", rowsAfter === 1, `got ${rowsAfter}`);

  console.log("— Check-in idempotency —");
  // The loser now holds the confirmed RSVP after the promotion above.
  const ticket = await prisma.rsvp.findFirstOrThrow({
    where: { eventId: event.id, userId: loser.id },
  });

  const first = await performCheckIn(event.id, ticket.ticketCode);
  check("first scan checks in", first.status === "ok", JSON.stringify(first));

  const second = await performCheckIn(event.id, ticket.ticketCode);
  check("second scan is 'duplicate', not a double count", second.status === "duplicate", JSON.stringify(second));

  const stored = await prisma.rsvp.findUniqueOrThrow({ where: { id: ticket.id } });
  check("checkedInAt stored exactly once", stored.checkedInAt !== null);

  const wrong = await performCheckIn(event.id, "not-a-real-code");
  check("unknown code is rejected", wrong.status === "invalid");

  // Cancelled RSVP can't be checked in. (This cancel also hands the seat
  // back to the ex-winner, who is still WAITLISTED — promotion side effect.)
  await performCancelRsvp(loser.id, event.id);
  const loserTicket = await prisma.rsvp.findFirstOrThrow({
    where: { eventId: event.id, userId: loser.id },
  });
  const cancelled = await performCheckIn(event.id, loserTicket.ticketCode);
  check("cancelled RSVP can't check in", cancelled.status === "cancelled", JSON.stringify(cancelled));

  console.log("— Full event queues a third RSVP —");
  const userC = await prisma.user.create({
    data: { name: "Race C", email: `race-c-${Date.now()}@test.dev`, passwordHash: "x" },
  });
  // The winner was auto-promoted by the cancel above, so the single seat
  // is taken again and the loser (freshly cancelled) re-queues.
  const loserBack = await performRsvp(loser.id, event.id);
  check("loser re-RSVPs ok (seat taken again)", loserBack.ok, loserBack.messageKey);
  const third = await performRsvp(userC.id, event.id);
  check(
    "third student joins the waitlist",
    third.ok && third.messageKey === "detail.rsvp.waitlisted",
    third.messageKey
  );
  const thirdRow = await prisma.rsvp.findFirstOrThrow({
    where: { eventId: event.id, userId: userC.id },
  });
  check("third student's DB row is WAITLISTED", thirdRow.status === "WAITLISTED", thirdRow.status);

  // Cleanup: cascade removes rsvps with the event/users.
  await prisma.rsvp.deleteMany({ where: { userId: { in: [userA.id, userB.id, userC.id] } } });
  await prisma.event.delete({ where: { id: event.id } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id, userC.id] } } });

  console.log("— Waitlist + automatic promotion (capacity = 2) —");
  const mkUser = (label: string) =>
    prisma.user.create({
      data: {
        name: `Waitlist ${label}`,
        email: `waitlist-${label.toLowerCase()}-${Date.now()}@test.dev`,
        passwordHash: "x",
      },
    });
  const [w1, w2, w3, w4, w5a, w5b] = await Promise.all([
    mkUser("W1"),
    mkUser("W2"),
    mkUser("W3"),
    mkUser("W4"),
    mkUser("W5a"),
    mkUser("W5b"),
  ]);
  const wlEvent = await prisma.event.create({
    data: {
      title: "Waitlist test (capacity 2)",
      description: "Temporary event for waitlist testing.",
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 90_000_000),
      location: "Test room",
      capacity: 2,
      status: "PUBLISHED",
      clubId: (await prisma.club.findFirstOrThrow()).id,
      categoryId: category.id,
    },
  });

  const r1 = await performRsvp(w1.id, wlEvent.id);
  const r2 = await performRsvp(w2.id, wlEvent.id);
  check(
    "A and B both confirmed",
    r1.messageKey === "detail.rsvp.done" && r2.messageKey === "detail.rsvp.done",
    `${r1.messageKey} / ${r2.messageKey}`
  );

  const r3 = await performRsvp(w3.id, wlEvent.id);
  check(
    "C is waitlisted (ok + key)",
    r3.ok && r3.messageKey === "detail.rsvp.waitlisted",
    r3.messageKey
  );
  const cRow = await prisma.rsvp.findFirstOrThrow({
    where: { eventId: wlEvent.id, userId: w3.id },
  });
  check("C's DB row is WAITLISTED", cRow.status === "WAITLISTED", cRow.status);

  const r3again = await performRsvp(w3.id, wlEvent.id);
  check(
    "re-RSVP while waitlisted is idempotent",
    r3again.ok && r3again.messageKey === "detail.rsvp.alreadyWaitlisted",
    r3again.messageKey
  );
  const stillTwo = await prisma.rsvp.count({
    where: { eventId: wlEvent.id, status: "CONFIRMED" },
  });
  check("still only 2 confirmed (no oversell)", stillTwo === 2, `got ${stillTwo}`);

  // A cancels → earliest waitlisted (C) promoted, keeping their ticket code.
  await performCancelRsvp(w1.id, wlEvent.id);
  const cAfter = await prisma.rsvp.findUniqueOrThrow({ where: { id: cRow.id } });
  check("A's cancel promotes C", cAfter.status === "CONFIRMED", cAfter.status);
  check("promotion keeps C's original ticket code", cAfter.ticketCode === cRow.ticketCode);

  // D RSVPs — the event is full again.
  const r4 = await performRsvp(w4.id, wlEvent.id);
  check(
    "D is waitlisted (event full again)",
    r4.ok && r4.messageKey === "detail.rsvp.waitlisted",
    r4.messageKey
  );

  // Check-in: the promoted student gets in; a waitlisted code never does.
  const cCheckIn = await performCheckIn(wlEvent.id, cAfter.ticketCode);
  check("promoted student checks in", cCheckIn.status === "ok", JSON.stringify(cCheckIn));
  const dRow = await prisma.rsvp.findFirstOrThrow({
    where: { eventId: wlEvent.id, userId: w4.id },
  });
  const dCheckIn = await performCheckIn(wlEvent.id, dRow.ticketCode);
  check("waitlisted ticket can't check in", dCheckIn.status === "waitlisted", JSON.stringify(dCheckIn));

  // FIFO with two queued: the EARLIEST waitlisted spot is promoted.
  await sleep(5); // distinct createdAt for the two queue rows below
  const r5a = await performRsvp(w5a.id, wlEvent.id);
  await sleep(5);
  const r5b = await performRsvp(w5b.id, wlEvent.id);
  check(
    "W5a and W5b both waitlisted",
    r5a.messageKey === "detail.rsvp.waitlisted" && r5b.messageKey === "detail.rsvp.waitlisted",
    `${r5a.messageKey} / ${r5b.messageKey}`
  );
  const w5aRow = await prisma.rsvp.findFirstOrThrow({
    where: { eventId: wlEvent.id, userId: w5a.id },
  });
  const w5bRow = await prisma.rsvp.findFirstOrThrow({
    where: { eventId: wlEvent.id, userId: w5b.id },
  });

  // B's cancel promotes the earliest queued student — that's D, who joined
  // the line before W5a/W5b.
  await performCancelRsvp(w2.id, wlEvent.id);
  const dAfter = await prisma.rsvp.findUniqueOrThrow({ where: { id: dRow.id } });
  check("B's cancel promotes the earliest queued (D)", dAfter.status === "CONFIRMED", dAfter.status);

  // FIFO with two still queued: the EARLIEST waitlisted spot is promoted.
  await performCancelRsvp(w3.id, wlEvent.id); // C gives up their seat
  const w5aAfter = await prisma.rsvp.findUniqueOrThrow({ where: { id: w5aRow.id } });
  const w5bAfter = await prisma.rsvp.findUniqueOrThrow({ where: { id: w5bRow.id } });
  check("C's cancel promotes the EARLIEST waitlisted (W5a)", w5aAfter.status === "CONFIRMED", w5aAfter.status);
  check("later waitlisted stays queued (W5b)", w5bAfter.status === "WAITLISTED", w5bAfter.status);

  // Queue rank: only W5b is still queued (W5a was promoted) → next in line = 1.
  const rank = await getWaitlistRank(wlEvent.id, w5bAfter.createdAt);
  check("waitlist rank = queued ahead + 1", rank === 1, `got ${rank}`);

  // Cleanup: cascade removes rsvps with the event/users.
  await prisma.rsvp.deleteMany({ where: { eventId: wlEvent.id } });
  await prisma.event.delete({ where: { id: wlEvent.id } });
  await prisma.user.deleteMany({
    where: { id: { in: [w1.id, w2.id, w3.id, w4.id, w5a.id, w5b.id] } },
  });

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
