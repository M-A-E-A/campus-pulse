import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mintQrPayload, secondsUntilRotation } from "@/lib/ticket-sign";

/**
 * Mints the signed, time-boxed string the ticket QR encodes:
 * `code|bucket|hmac` (see ticket-sign.ts). A screenshot of the QR stops
 * verifying after its 60s slot; the raw code shown under the QR keeps
 * working for manual entry at the door.
 *
 * Owner-only: the rsvp must belong to the session user. `no-store` so a
 * proxy never hands one student another student's (or an older slot's) QR.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ rsvpId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { rsvpId } = await params;

  const rsvp = await prisma.rsvp.findUnique({
    where: { id: rsvpId },
    select: {
      userId: true,
      status: true,
      ticketCode: true,
      event: { select: { status: true } },
    },
  });
  if (!rsvp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rsvp.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // The waitlist panel never shows a QR; this just guards stale tabs
  // where the RSVP was cancelled after the page rendered.
  if (rsvp.status !== "CONFIRMED") {
    return NextResponse.json({ error: "No confirmed RSVP" }, { status: 409 });
  }

  return NextResponse.json(
    {
      payload: mintQrPayload(rsvp.ticketCode),
      expiresInSec: secondsUntilRotation(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
