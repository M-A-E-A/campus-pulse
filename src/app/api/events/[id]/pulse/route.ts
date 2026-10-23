import { auth, isClubOrganizer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PulsePayload = {
  total: number;
  checkedIn: number;
  capacity: number | null;
  recent: { name: string; at: string }[];
};

/** One snapshot of the door numbers — cheap enough to re-run every 2.5s. */
async function readPayload(
  eventId: string,
  capacity: number | null
): Promise<PulsePayload> {
  const confirmed = { eventId, status: "CONFIRMED" as const };
  const [total, checkedIn, recent] = await Promise.all([
    prisma.rsvp.count({ where: confirmed }),
    prisma.rsvp.count({ where: { ...confirmed, checkedInAt: { not: null } } }),
    prisma.rsvp.findMany({
      where: { ...confirmed, checkedInAt: { not: null } },
      orderBy: { checkedInAt: "desc" },
      take: 6,
      select: { checkedInAt: true, user: { select: { name: true } } },
    }),
  ]);

  return {
    total,
    checkedIn,
    capacity,
    // the `not: null` filter already guarantees this, TS can't see it
    recent: recent.flatMap((r) =>
      r.checkedInAt ? [{ name: r.user.name, at: r.checkedInAt.toISOString() }] : []
    ),
  };
}

/**
 * Live check-in counter behind EventSource (SSE).
 *
 * Tradeoff, on purpose: one open connection per viewer, each polling the
 * database every 2.5s. At classroom scale (a projector, a couple of
 * organizer tabs) that's a handful of tiny COUNT queries and no pub/sub
 * infrastructure — `next start` is single-process here, so Prisma
 * listen/notify or Redis would buy nothing yet. If this ever runs
 * multi-instance, this is the first thing to move to a shared channel.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, clubId: true, capacity: true },
  });
  if (!event) return new Response("Not found", { status: 404 });

  const allowed =
    session.user.role === "ADMIN" ||
    (await isClubOrganizer(session.user.id, event.clubId));
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const capacity = event.capacity;
  const encoder = new TextEncoder();
  let lastJson = "";
  // `cancel()` can fire from outside start()'s scope, so the teardown lives here
  let stopStream: (() => void) | null = null;
  // set the moment the client goes away, even mid-first-push
  let clientGone = false;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      // client disconnect (tab closed, projector asleep) → free the polls
      req.signal.addEventListener(
        "abort",
        () => {
          clientGone = true;
          stopStream?.();
        },
        { once: true }
      );

      const send = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // the runtime cancelled the stream under us; stop enqueueing
          closed = true;
        }
      };

      // Only emit on change: an unchanged snapshot would still be a write
      // to every open socket, forever, for nothing. The `polling` guard stops
      // a slow query from overlapping the next tick and replaying an older
      // snapshot — the counter must never animate backwards.
      let polling = false;
      const push = async () => {
        if (polling) return;
        polling = true;
        try {
          const json = JSON.stringify(await readPayload(event.id, capacity));
          if (json === lastJson) return;
          lastJson = json;
          send(`data: ${json}\n\n`);
        } finally {
          polling = false;
        }
      };

      try {
        await push(); // first frame goes out before the client paints its 0-state
      } catch {
        // db hiccup at connect time: end the stream, EventSource retries
        try {
          controller.close();
        } catch {
          // already torn down
        }
        return;
      }

      // client vanished while the first frame was being built — no point
      // starting polls nobody will read
      if (clientGone) {
        try {
          controller.close();
        } catch {
          // already torn down
        }
        return;
      }

      // comment lines keep proxies/load balancers from idling the connection out
      const heartbeat = setInterval(() => send(": ping\n\n"), 15000);
      const ticker = setInterval(() => {
        push().catch(() => {
          // a failed poll just delays the next one; the stream stays open
        });
      }, 2500);

      const stop = () => {
        // clear first: `send` may have already marked the stream closed on a
        // failed enqueue, and the intervals must die either way
        clearInterval(heartbeat);
        clearInterval(ticker);
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      stopStream = stop;
    },
    cancel() {
      // some runtimes surface the disconnect here instead of on req.signal
      clientGone = true;
      stopStream?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
