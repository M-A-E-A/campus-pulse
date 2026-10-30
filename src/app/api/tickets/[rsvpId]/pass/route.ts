import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/tz";
import { getT, getLocale } from "@/i18n/server";
import {
  buildPkpass,
  getPassConfig,
  type PassLabels,
} from "@/lib/pkpass";

/**
 * Serves the Apple Wallet pass for a confirmed RSVP — quick win 2,
 * part B. Structure and signing live in `src/lib/pkpass.ts`; this file
 * is the same owner guard as the QR route plus two honest answers:
 *
 * - certs not configured → 503 `reason:"not_configured"`. The ticket
 *   page already knows this from `isPassConfigured()` and shows a note
 *   instead of the button (Phase 1b rule: no dead CTA), so the 503 is
 *   the belt to that suspenders for stale tabs and scripts.
 * - configured but signing blows up (bad path, wrong passphrase) →
 *   503 `reason:"sign_failed"`, logged. The UI's download handler turns
 *   either into the honest inline error with the print fallback.
 *
 * `no-store`: like the QR route, a pass must never be replayed from a
 * shared proxy's cache.
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
      event: {
        select: {
          title: true,
          startsAt: true,
          location: true,
          status: true,
          club: { select: { name: true } },
        },
      },
    },
  });
  if (!rsvp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rsvp.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (rsvp.status !== "CONFIRMED") {
    return NextResponse.json({ error: "No confirmed RSVP" }, { status: 409 });
  }

  const config = getPassConfig();
  if (!config) {
    return NextResponse.json(
      {
        error: "Apple Wallet export is not configured on this server.",
        reason: "not_configured",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const labels: PassLabels = {
    event: t("ticket.pass.eventLabel"),
    date: t("ticket.pass.dateLabel"),
    location: t("ticket.pass.locationLabel"),
    club: t("ticket.pass.clubLabel"),
    code: t("ticket.pass.codeLabel"),
  };

  try {
    const pass = buildPkpass(config, {
      serialNumber: rsvp.ticketCode,
      eventTitle: rsvp.event.title,
      startsAtLabel: formatDateTime(rsvp.event.startsAt, locale),
      startsAtIso: rsvp.event.startsAt.toISOString(),
      location: rsvp.event.location,
      clubName: rsvp.event.club.name,
      ticketCode: rsvp.ticketCode,
    }, labels);
    return new NextResponse(new Uint8Array(pass), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="campus-pulse-${rsvp.ticketCode}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("pkpass build failed:", err);
    return NextResponse.json(
      {
        error: "Pass signing failed on this server.",
        reason: "sign_failed",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
