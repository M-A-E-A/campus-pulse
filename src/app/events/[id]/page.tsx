import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getWaitlistRank } from "@/lib/rsvp-core";
import { formatDate, formatEventRange, formatDateTime, isSameCampusDay } from "@/lib/tz";
import { getT, getLocale } from "@/i18n/server";
import { RsvpSection } from "@/components/events/RsvpSection";
import { AttendeeGrid } from "@/components/events/AttendeeGrid";
import { PostEventThanks } from "@/components/events/PostEventThanks";
import { DistanceAway } from "@/components/events/DistanceAway";
import { SaveFollowButtons } from "@/components/events/SaveFollowButtons";
import { SharePosterButton } from "@/components/events/SharePosterButton";
import { Entrance } from "@/components/Entrance";
import type { TicketData } from "@/components/events/Ticket";

/** One fetch shared by the page and generateMetadata (React memoization). */
const getEvent = cache(async (id: string) =>
  prisma.event.findUnique({
    where: { id },
    include: {
      club: true,
      category: true,
      _count: { select: { rsvps: { where: { status: "CONFIRMED" } } } },
    },
  })
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [event, t] = await Promise.all([getEvent(id), getT()]);
  if (!event || event.status !== "PUBLISHED") return { title: t("detail.meta.notFound") };
  const description =
    event.description.length > 155
      ? `${event.description.slice(0, 152)}…`
      : event.description;
  return {
    title: `${event.title} — Campus Pulse`,
    description,
    // No openGraph.images here: the opengraph-image.tsx convention owns
    // og:image (1200×630 poster with width/height/type). A cover-photo card
    // and a poster card can't both be the first preview a stranger sees.
    openGraph: { title: event.title, description },
    // summary_large_image makes X/WhatsApp ask for the full poster instead
    // of a thumbnail; Twitter falls back to og:image for the URL itself.
    twitter: { card: "summary_large_image" },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Locale drives the printed dates: a French page must not print English
  // weekday names under its headline.
  const [session, t, locale] = await Promise.all([auth(), getT(), getLocale()]);

  const event = await getEvent(id);

  if (!event || event.status !== "PUBLISHED") notFound();

  const start = event.startsAt;
  const end = event.endsAt;
  const taken = event._count.rsvps;
  const spotsLeft = event.capacity !== null ? event.capacity - taken : null;
  const percent = event.capacity !== null ? Math.min(100, (taken / event.capacity) * 100) : 0;
  const isFull = event.capacity !== null && taken >= event.capacity;
  // One cutoff drives the whole Phase 7 loop: the thank-you band, the
  // feedback guards and the "next up" pick all ask whether it's over.
  const hasEnded = end.getTime() < Date.now();

  // Waitlist size for the capacity line. Separate query on purpose: Prisma's
  // _count can carry only one filter per relation, and the shared getEvent
  // already counts CONFIRMED rsvps through it.
  const waitlistCount =
    event.capacity !== null
      ? await prisma.rsvp.count({ where: { eventId: event.id, status: "WAITLISTED" } })
      : 0;

  // "Who's going": first names of the EARLIEST confirmed RSVPs, capped at
  // 12 (AttendeeGrid owns the disclosure rule — first names only). Upcoming
  // events only: an ended event has the post-event band, and "going" over a
  // past event would be a lie. Waitlisted RSVPs aren't seats, never shown.
  const going =
    !hasEnded && taken > 0
      ? await prisma.rsvp.findMany({
          where: { eventId: event.id, status: "CONFIRMED" },
          orderBy: { createdAt: "asc" },
          take: 12,
          select: { user: { select: { name: true } } },
        })
      : [];

  // The signed-in user's own RSVP + saved/follow state, for the client bits.
  let existingRsvp: TicketData | null = null;
  let isSaved = false;
  let isFollowing = false;
  // The band exists only for an ENDED event the visitor holds a CONFIRMED
  // ticket for; nextUp is that club's next published event, minus anything
  // they're already booked on.
  let postEvent: { attended: boolean; answer: boolean | null } | null = null;
  let nextUp: { id: string; title: string; dateLabel: string } | null = null;
  if (session?.user) {
    const [rsvp, saved, follow] = await Promise.all([
      prisma.rsvp.findUnique({
        where: { userId_eventId: { userId: session.user.id, eventId: event.id } },
      }),
      prisma.savedEvent.findUnique({
        where: { userId_eventId: { userId: session.user.id, eventId: event.id } },
      }),
      prisma.follow.findUnique({
        where: { userId_clubId: { userId: session.user.id, clubId: event.clubId } },
      }),
    ]);
    if (rsvp && rsvp.status === "CONFIRMED") {
      existingRsvp = {
        rsvpId: rsvp.id,
        ticketCode: rsvp.ticketCode,
        checkedInAt: rsvp.checkedInAt?.toISOString() ?? null,
        startsAtLabel: formatDateTime(event.startsAt, locale),
        event: {
          title: event.title,
          startsAt: event.startsAt.toISOString(),
          location: event.location,
          clubName: event.club.name,
        },
      };
    } else if (rsvp && rsvp.status === "WAITLISTED") {
      // Queue spot, not a ticket: no code/QR, just the position in line.
      existingRsvp = {
        rsvpId: rsvp.id,
        ticketCode: "",
        checkedInAt: null,
        waitlisted: true,
        rank: await getWaitlistRank(event.id, rsvp.createdAt),
        startsAtLabel: formatDateTime(event.startsAt, locale),
        event: {
          title: event.title,
          startsAt: event.startsAt.toISOString(),
          location: event.location,
          clubName: event.club.name,
        },
      };
    }
    isSaved = Boolean(saved);
    isFollowing = Boolean(follow);

    // Post-event: only a ticket holder gets thanked, and only after the end.
    // The recommendation skips events they already RSVP'd to — the loop must
    // suggest something new, never what is already in their pocket.
    if (rsvp && rsvp.status === "CONFIRMED" && hasEnded) {
      postEvent = { attended: rsvp.checkedInAt !== null, answer: rsvp.attendAgain };
      const next = await prisma.event.findFirst({
        where: {
          clubId: event.clubId,
          status: "PUBLISHED",
          endsAt: { gte: new Date() },
          id: { not: event.id },
          rsvps: { none: { userId: session.user.id } },
        },
        orderBy: { startsAt: "asc" },
        select: { id: true, title: true, startsAt: true },
      });
      if (next) {
        nextUp = { id: next.id, title: next.title, dateLabel: formatDate(next.startsAt, locale) };
      }
    }
  }

  return (
    <div className="field-paper detail-page min-h-screen">
      <Entrance />

      {/* The poster: full-bleed ink band, the title carrying it. */}
      <header className="field-ink">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:pt-16">
          <h1 className="display-title" data-rise>
            {event.title}
          </h1>
          {/* The range already carries both dates on a multi-day event —
              prepending the start date would print it twice. */}
          <p
            className="mt-5 max-w-[52ch] text-balance text-[length:var(--step-lead)]"
            data-rise
          >
            {isSameCampusDay(start, end)
              ? `${formatDate(start, locale)} · ${formatEventRange(start, end, locale)}`
              : formatEventRange(start, end, locale)}
          </p>
          {/* Credits line sits below the title on purpose: category and club
              above a headline read as a kicker, which the poster system bans. */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2" data-rise>
            <span className="bg-accent px-2.5 py-1 text-sm font-bold text-ink">
              {event.category.name}
            </span>
            <span className="text-sm font-semibold text-paper/75">{event.club.name}</span>
          </div>
        </div>
      </header>

      {/* Facts rail: the same orange band the events list runs on. The venue
          and the live capacity sit here so both clear the mobile fold. */}
      <div className="field-orange" data-rise>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4">
          {/* 20px: the venue is a fact on the rail. Set any smaller it reads as
              a label sitting above the next heading — the banned kicker. */}
          <span className="text-xl font-semibold text-balance">{event.location}</span>
          {/* Distance renders ONLY when geolocation was already granted —
              a page load never asks (DistanceAway's own rule). */}
          {event.lat !== null && event.lng !== null && (
            <DistanceAway lat={event.lat} lng={event.lng} />
          )}
          {/* text-xl, not the inherited 16: at 16 this live fact reads as a
              small label sitting above the next heading — the banned kicker.
              The numeric fact is lg+ only: on phones the meter panel directly
              under the rail already states the capacity, and repeating it
              spends fold height on the one screen with none to spare. An
              uncapped event has no meter, so its "open to all" stays put. */}
          {event.capacity === null ? (
            <p className="text-xl font-semibold">{t("detail.openToAll")}</p>
          ) : (
            <p className="hidden text-xl font-semibold lg:block">
              {t("detail.rsvp.spotsTaken", { n: taken, total: event.capacity })}
            </p>
          )}
          <div className="sm:ms-auto">
            <SaveFollowButtons
              eventId={event.id}
              clubId={event.clubId}
              isSaved={isSaved}
              isFollowing={isFollowing}
              isAuthenticated={Boolean(session?.user)}
            />
          </div>
        </div>
      </div>

      {/* Phase 7: the post-event loop — a closing cover for people who were
          there, asking the one question that feeds recommendations. */}
      {postEvent && (
        <PostEventThanks
          eventId={event.id}
          clubName={event.club.name}
          attended={postEvent.attended}
          initialAnswer={postEvent.answer}
          nextUp={nextUp}
        />
      )}

      {event.coverImage && (
        <div className="mx-auto max-w-6xl px-4 pt-8" data-rise>
          <Image
            src={event.coverImage}
            alt=""
            width={1400}
            height={600}
            priority
            className="aspect-[21/9] w-full border-2 border-ink object-cover"
          />
        </div>
      )}

      {/* gap-20 (80px) on phones/tablets: the action panel is DOM-first now, so
          its last control must clear the 72px proximity band the next heading
          scans — otherwise a control label reads as that heading's kicker.
          lg restores the 40px column gutter. */}
      <div className="mx-auto grid max-w-6xl gap-20 px-4 py-10 lg:grid-cols-[1fr_22rem] lg:gap-10">
        {/* The RSVP action leads. On a phone the grid is one column, so putting
            the sidebar first in the DOM keeps the capacity meter and the CTA
            above the fold instead of trailing the whole article. On lg the
            columns are placed explicitly, so the story sits left and the panel
            right — reading order and DOM order agree at both sizes. */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:self-start">
          {/* Meter only: the "X of Y taken" headline now lives on the facts
              rail above, so repeating it here would print the number twice. */}
          {event.capacity !== null && (
            <div className="border-2 border-ink bg-surface p-5" data-rise>
              <div
                className="h-3 border border-ink bg-line"
                role="progressbar"
                aria-valuenow={taken}
                aria-valuemin={0}
                aria-valuemax={event.capacity}
                aria-label={t("detail.spotsTakenLabel")}
              >
                <div
                  className="h-full bg-accent"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-ink/75">
                {spotsLeft !== null && spotsLeft > 0
                  ? spotsLeft === 1
                    ? t("detail.spotsLeftOne", { n: spotsLeft })
                    : t("common.spotsLeft", { n: spotsLeft })
                  : t("detail.noSpotsLeft")}
                {waitlistCount > 0 && (
                  <>
                    {" · "}
                    {t("detail.rsvp.onWaitlist", { n: waitlistCount })}
                  </>
                )}
              </p>
            </div>
          )}

          <div data-rise>
            <RsvpSection
              eventId={event.id}
              isAuthenticated={Boolean(session?.user)}
              existingRsvp={existingRsvp}
              startsAtLabel={formatDateTime(event.startsAt, locale)}
              isFull={isFull}
            />
          </div>

          <div className="space-y-3" data-rise>
            <a
              href={`/api/events/${event.id}/calendar`}
              // Same 2px ink frame as the poster panel it sits under, so the
              // calendar action reads as part of the panel, not a stray control.
              className="btn btn-secondary w-full border-2 border-ink bg-surface"
            >
              {t("detail.addToCalendar")}
            </a>
            {/* The poster is the event leaving the site: Web Share where the
                browser supports sharing files, otherwise the poster document
                opens — which is also the print path (vector, any size). */}
            <SharePosterButton eventId={event.id} title={event.title} />
            {session?.user && (
              <Link
                href="/dashboard"
                className="block text-center text-sm font-semibold text-ink/80 hover:text-ink"
              >
                {t("detail.seeTickets")}
              </Link>
            )}
          </div>
        </aside>

        <div className="lg:col-start-1 lg:row-start-1">
          <h2 className="display-chapter" data-rise>
            {t("detail.about")}
          </h2>
          <p
            className="mt-4 max-w-[38rem] whitespace-pre-line text-[length:var(--step-body)] leading-relaxed"
            data-rise
          >
            {event.description}
          </p>

          {going.length > 0 && (
            <AttendeeGrid
              firstNames={going.map((r) => r.user.name.trim().split(/\s+/)[0])}
              total={taken}
            />
          )}

          <h2 className="display-chapter mt-14" data-rise>
            {t("detail.organizer")}
          </h2>
          <div className="mt-5 flex items-start gap-4 border-2 border-ink bg-surface p-5" data-rise>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-ink text-xl font-extrabold text-paper">
              {event.club.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold">
                {/* The club name leads to its poster profile — the same
                    entity the byline credits. */}
                <Link
                  href={`/clubs/${event.club.id}`}
                  className="underline-offset-4 hover:text-accent hover:underline"
                >
                  {event.club.name}
                </Link>
              </p>
              <p className="mt-1 text-[length:var(--step-body)] text-ink/80">
                {event.club.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
