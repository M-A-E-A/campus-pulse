import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getWaitlistRank } from "@/lib/rsvp-core";
import { formatDateTime } from "@/lib/tz";
import { getT, getLocale } from "@/i18n/server";
import { isPassConfigured } from "@/lib/pkpass";
import { TicketFull } from "@/components/tickets/TicketFull";

/**
 * The standalone full-screen ticket — the thing you hold up at the door.
 *
 * Why this route exists separately from the event page: at the venue the
 * wifi dies exactly when you need it, and a ticket you cannot open is a
 * ticket you cannot use. The service worker caches THIS route's HTML
 * (network-first, cache fallback — see public/sw.js) and nothing else in
 * the app caches page HTML, so the trade is explicit: one narrow route
 * buys an offline door, and sign-out purges it so a shared machine never
 * hands the next student a cached credential.
 *
 * Ownership: the rsvp must belong to the session user. A stranger gets
 * 404 rather than 403 — an id that answers "forbidden" is an id that
 * exists, and these ids are cuids.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t("ticket.title")} — Campus Pulse` };
}

export default async function TicketPage({
  params,
}: {
  params: Promise<{ rsvpId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { rsvpId } = await params;
  const rsvp = await prisma.rsvp.findUnique({
    where: { id: rsvpId },
    select: {
      id: true,
      userId: true,
      status: true,
      ticketCode: true,
      checkedInAt: true,
      createdAt: true,
      event: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          location: true,
          status: true,
          club: { select: { name: true } },
        },
      },
    },
  });
  if (!rsvp || rsvp.userId !== session.user.id) notFound();

  const [t, locale] = await Promise.all([getT(), getLocale()]);

  // A queue spot is not a ticket: no code, no QR, just the position.
  // A cancelled RSVP, or a cancelled/rejected event, must not show a QR
  // that the door would then have to refuse.
  const waitlisted = rsvp.status === "WAITLISTED";
  const dead =
    rsvp.status === "CANCELLED" ||
    (rsvp.status === "CONFIRMED" && rsvp.event.status !== "PUBLISHED");
  const rank =
    waitlisted && !dead ? await getWaitlistRank(rsvp.event.id, rsvp.createdAt) : 0;

  const state = dead ? "cancelled" : waitlisted ? "waitlisted" : "confirmed";

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8" data-ticket={state}>
      <div className="border-2 border-ink bg-white">
        <div
          data-tickethead
          className="border-b-2 border-ink bg-ink px-5 py-4 text-paper print:border-b print:border-ink print:bg-white print:text-ink"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-paper/70 print:text-muted">
            {rsvp.event.club.name}
          </p>
          <h1 className="mt-1 text-xl font-extrabold leading-tight">
            {rsvp.event.title}
          </h1>
          <p className="mt-1 text-sm text-paper/80 print:text-ink">
            {formatDateTime(rsvp.event.startsAt, locale)} · {rsvp.event.location}
          </p>
        </div>

        {dead ? (
          <div className="px-5 py-6" data-ticketstate="cancelled">
            <p className="text-lg font-bold">{t("ticket.cancelled")}</p>
            <p className="mt-2 text-sm text-muted">{t("ticket.cancelledBody")}</p>
            <Link
              href={`/events/${rsvp.event.id}`}
              className="btn btn-secondary mt-5 w-full"
            >
              {t("ticket.backToEvent")}
            </Link>
          </div>
        ) : waitlisted ? (
          <div className="px-5 py-6" data-ticketstate="waitlisted">
            <p className="text-lg font-bold">{t("ticket.waitlistTitle")}</p>
            <p className="mt-2 text-sm text-muted">
              {t("ticket.waitlistBody", { rank: String(rank) })}
            </p>
            <Link
              href={`/events/${rsvp.event.id}`}
              className="btn btn-secondary mt-5 w-full"
            >
              {t("ticket.backToEvent")}
            </Link>
          </div>
        ) : (
          <div className="px-5 py-5" data-ticketstate="confirmed">
            <TicketFull
              ticket={{
                rsvpId: rsvp.id,
                ticketCode: rsvp.ticketCode,
                checkedInAt: rsvp.checkedInAt?.toISOString() ?? null,
                startsAtLabel: formatDateTime(rsvp.event.startsAt, locale),
                event: {
                  title: rsvp.event.title,
                  startsAt: rsvp.event.startsAt.toISOString(),
                  location: rsvp.event.location,
                  clubName: rsvp.event.club.name,
                },
              }}
              eventHref={`/events/${rsvp.event.id}`}
              walletConfigured={isPassConfigured()}
            />
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted" data-print-hide>
        <Link href="/dashboard" className="font-semibold hover:underline">
          {t("nav.myTickets")}
        </Link>
      </p>
    </main>
  );
}
