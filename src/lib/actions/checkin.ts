"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { performCheckIn } from "@/lib/rsvp-core";
import { verifyQrPayload } from "@/lib/ticket-sign";

type CoreCheckInResult = import("@/lib/rsvp-core").CheckInResult;

/** Core outcomes plus the QR-expiry and the two authorization outcomes. */
export type CheckInResult =
  | CoreCheckInResult
  | { status: "expired" }
  | { status: "forbidden" }
  | { status: "unauthorized" };

/**
 * Check a ticket in at the door.
 * Authorization (logged in + member of the event's club) happens here;
 * the idempotent marking lives in rsvp-core.ts.
 *
 * Input is either a raw ticket code (typed by hand) or a signed QR
 * payload `code|bucket|hmac` (see ticket-sign.ts) — anything containing
 * "|" goes through signature + time-slot verification first, so a
 * screenshot of an old QR is refused while manual entry keeps working.
 *
 * The raw status is returned to the door screen, which maps each one to a
 * message key in the organizer dictionary (checkInScanner.tsx):
 *   ok → org.checkin.ok        duplicate → org.checkin.duplicate
 *   invalid → org.checkin.invalid        cancelled → org.checkin.cancelled
 *   expired → qr.checkin.expired
 *   forbidden → org.checkin.forbidden    unauthorized → org.checkin.unauthorized
 */
export async function checkInAction(
  eventId: string,
  ticketCode: string
): Promise<CheckInResult> {
  const session = await auth();
  if (!session?.user) return { status: "unauthorized" };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { clubId: true },
  });
  if (!event) return { status: "invalid" };

  const membership = await prisma.clubMember.findUnique({
    where: { userId_clubId: { userId: session.user.id, clubId: event.clubId } },
  });
  if (!membership && session.user.role !== "ADMIN") return { status: "forbidden" };

  // Raw codes have no "|" — they skip verification exactly as before.
  let code = ticketCode;
  if (ticketCode.includes("|")) {
    const verified = verifyQrPayload(ticketCode);
    if (!verified.ok) {
      return verified.reason === "expired"
        ? { status: "expired" }
        : { status: "invalid" };
    }
    code = verified.code;
  }

  const result = await performCheckIn(eventId, code);
  if (result.status === "ok" || result.status === "duplicate") {
    revalidatePath(`/organizer/events/${eventId}/attendees`);
  }
  return result;
}
