import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getWaitlistRank } from "@/lib/rsvp-core";
import { formatDate, formatEventRange, formatDateTime } from "@/lib/tz";
import { getT } from "@/i18n/server";
import { RsvpSection } from "@/components/events/RsvpSection";
import { SaveFollowButtons } from "@/components/events/SaveFollowButtons";
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
  return {
    title: `${event.title} — Campus Pulse`,
    description:
      event.description.length > 155
        ? `${event.description.slice(0, 152)}…`
        : event.description,
    ...(event.coverImage
      ? { openGraph: { title: event.title, images: [{ url: event.coverImage }] } }
      : {}),
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, t] = await Promise.all([auth(), getT()]);

  const event = await getEvent(id);

  if (!event || event.status !== "PUBLISHED") notFound();

  const start = event.startsAt;
  const end = event.endsAt;
  const taken = event._count.rsvps;
  const spotsLeft = event.capacity !== null ? event.capacity - taken : null;
  const percent = event.capacity !== null ? Math.min(100, (taken / event.capacity) * 100) : 0;
  const isFull = event.capacity !== null && taken >= event.capacity;

  // Waitlist size for the capacity line. Separate query on purpose: Prisma's
  // _count can carry only one filter per relation, and the shared getEvent
  // already counts CONFIRMED rsvps through it.
  const waitlistCount =
    event.capacity !== null
      ? await prisma.rsvp.count({ where: { eventId: event.id, status: "WAITLISTED" } })
      : 0;

  // The signed-in user's own RSVP + saved/follow state, for the client bits.
  let existingRsvp: TicketData | null = null;
  let isSaved = false;
  let isFollowing = false;
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
        startsAtLabel: formatDateTime(event.startsAt),
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
        startsAtLabel: formatDateTime(event.startsAt),
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
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {event.coverImage && (
        <Image
          src={event.coverImage}
          alt=""
          width={1400}
          height={600}
          priority
          className="mb-8 aspect-[21/9] w-full rounded-2xl object-cover"
        />
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div>
          <span className="badge bg-accent-soft text-accent-dark">{event.category.name}</span>
          <h1 className="mt-3 text-4xl font-bold leading-tight">{event.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-muted">
            <p className="font-medium text-ink">
              {formatDate(start)} · {formatEventRange(start, end)}
            </p>
            <p>{event.location}</p>
          </div>

          <div className="mt-4">
            <SaveFollowButtons
              eventId={event.id}
              clubId={event.clubId}
              isSaved={isSaved}
              isFollowing={isFollowing}
              isAuthenticated={Boolean(session?.user)}
            />
          </div>

          <hr className="my-8 border-line" />

          <h2 className="text-xl font-semibold">{t("detail.about")}</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-ink/90">
            {event.description}
          </p>

          <hr className="my-8 border-line" />

          <h2 className="text-xl font-semibold">{t("detail.organizer")}</h2>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft font-bold text-accent-dark">
              {event.club.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{event.club.name}</p>
              <p className="text-sm text-muted">{event.club.description}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: capacity + RSVP */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            <p className="font-semibold">
              {event.capacity === null ? (
                <span>{t("detail.openToAll")}</span>
              ) : (
                <span>
                  {t("detail.rsvp.spotsTaken", {
                    n: taken,
                    total: event.capacity,
                  })}
                  {waitlistCount > 0 && (
                    <>
                      {" · "}
                      {t("detail.rsvp.onWaitlist", { n: waitlistCount })}
                    </>
                  )}
                </span>
              )}
            </p>
            {event.capacity !== null && (
              <>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-line"
                  role="progressbar"
                  aria-valuenow={taken}
                  aria-valuemin={0}
                  aria-valuemax={event.capacity}
                  aria-label={t("detail.spotsTakenLabel")}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {spotsLeft !== null && spotsLeft > 0
                    ? spotsLeft === 1
                      ? t("detail.spotsLeftOne", { n: spotsLeft })
                      : t("common.spotsLeft", { n: spotsLeft })
                    : t("detail.noSpotsLeft")}
                </p>
              </>
            )}
          </div>

          <a
            href={`/api/events/${event.id}/calendar`}
            className="btn btn-secondary w-full"
          >
            {t("detail.addToCalendar")}
          </a>

          <RsvpSection
            eventId={event.id}
            isAuthenticated={Boolean(session?.user)}
            existingRsvp={existingRsvp}
            startsAtLabel={formatDateTime(event.startsAt)}
            isFull={isFull}
          />

          {session?.user && (
            <Link href="/dashboard" className="block text-center text-sm text-muted hover:text-ink">
              {t("detail.seeTickets")}
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
