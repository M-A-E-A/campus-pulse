import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { createEventReminders } from "@/lib/notifications-core";

/**
 * Reminder pass for the scheduler. Two windows per run:
 *
 *   24h slot — events starting in (now+1h, now+24h]  → "Don't forget: X"
 *    1h slot — events starting in (now,     now+1h]  → "Starting soon: X"
 *
 * The windows are disjoint, so an event an hour out never gets both lines in
 * the same run, and the (userId, eventId, dedupeKey) unique index inside
 * createEventReminders makes every pass idempotent: however often the job
 * fires, each attendee hears each slot exactly once.
 *
 * Only PUBLISHED events are considered, which also excludes cancelled ones
 * (their status flips away from PUBLISHED), so nobody is reminded about an
 * event that is no longer happening.
 *
 * Auth: a shared CRON_SECRET, compared in constant time. With no secret
 * configured the route refuses to run (503) rather than silently serving an
 * unguarded endpoint — forgetting to configure it fails closed, not open.
 * Invoke as `GET /api/cron/reminders` with `Authorization: Bearer <secret>`
 * (Vercel cron style) or `?secret=<secret>` for a plain system cron / Task
 * Scheduler line where custom headers are awkward.
 */
const HOUR_MS = 3_600_000;

function secretMatches(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const given =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    "";
  if (!secretMatches(secret, given)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const windows = [
    {
      slot: "24h" as const,
      from: new Date(now + HOUR_MS),
      to: new Date(now + 24 * HOUR_MS),
    },
    { slot: "1h" as const, from: new Date(now), to: new Date(now + HOUR_MS) },
  ];

  const created: Record<string, number> = {};
  for (const w of windows) {
    const events = await prisma.event.findMany({
      where: { status: "PUBLISHED", startsAt: { gt: w.from, lte: w.to } },
      select: { id: true },
    });
    const counts = await Promise.all(events.map((e) => createEventReminders(e.id, w.slot)));
    created[w.slot] = counts.reduce((sum, n) => sum + n, 0);
  }

  return Response.json({ ok: true, at: new Date(now).toISOString(), created });
}
