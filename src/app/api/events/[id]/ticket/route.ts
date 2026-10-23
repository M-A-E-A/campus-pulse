import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWaitlistRank } from "@/lib/rsvp-core";

/** Returns the current user's ticket (or waitlist spot) for this event. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const rsvp = await prisma.rsvp.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId: id } },
    include: {
      event: {
        select: {
          title: true,
          startsAt: true,
          location: true,
          club: { select: { name: true } },
        },
      },
    },
  });

  if (!rsvp) {
    return NextResponse.json({ error: "No RSVP" }, { status: 404 });
  }

  if (rsvp.status === "WAITLISTED") {
    // Queue spot, not a ticket: no code, no QR — just the position.
    const rank = await getWaitlistRank(id, rsvp.createdAt);
    return NextResponse.json({
      rsvpId: rsvp.id,
      ticketCode: "",
      checkedInAt: null,
      waitlisted: true,
      rank,
      event: {
        title: rsvp.event.title,
        startsAt: rsvp.event.startsAt.toISOString(),
        location: rsvp.event.location,
        clubName: rsvp.event.club.name,
      },
    });
  }

  if (rsvp.status !== "CONFIRMED") {
    return NextResponse.json({ error: "No confirmed RSVP" }, { status: 404 });
  }

  return NextResponse.json({
    rsvpId: rsvp.id,
    ticketCode: rsvp.ticketCode,
    checkedInAt: rsvp.checkedInAt?.toISOString() ?? null,
    event: {
      title: rsvp.event.title,
      startsAt: rsvp.event.startsAt.toISOString(),
      location: rsvp.event.location,
      clubName: rsvp.event.club.name,
    },
  });
}
