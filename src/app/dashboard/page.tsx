import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWaitlistRank } from "@/lib/rsvp-core";
import { ensureCalendarToken } from "@/lib/calendar-token";
import { CalendarSubscribe } from "@/components/dashboard/CalendarSubscribe";
import { headers } from "next/headers";
import {
  formatDate,
  formatEventRange,
  formatMonthShort,
  formatDayNumber,
  isSameCampusDay,
} from "@/lib/tz";
import { getT, getLocale } from "@/i18n/server";

/**
 * Student dashboard: my tickets, saved, past, clubs, calendar feed.
 *
 * Reskin, not a rebuild — the queries, redirects and token logic below are
 * untouched. What changed is how it is dressed, and the two things that made
 * it feel unlike the rest of the product:
 *
 *  - Surfaces are FILLED, not outlined. The old list drew a 1px card per row;
 *    at three or more upcoming RSVPs that reads as a grid of empty boxes.
 *    A row is now a poster spine: an ink date block butted against a filled
 *    panel, square corners throughout.
 *  - Status chips are flat ink/accent instead of the pale yellow and green
 *    fills. Those measured 4.39:1 (success on #e6f4ea) — under the AA floor —
 *    and sat outside the drawn palette. Ink on paper is 12:1, ink on accent
 *    5.6:1.
 *
 * The title stays at app size (27px phone / 32px desktop): this is a working
 * screen, not a landing page, so display type would be a lie about how much
 * attention the page deserves.
 */
export default async function StudentDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const t = await getT();
  // Locale drives every printed date on this screen.
  const locale = await getLocale();
  const userId = session.user.id;
  const now = new Date();
  const reqHeaders = await headers();
  const feedOrigin = `${reqHeaders.get("x-forwarded-proto") ?? "http"}://${reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host") ?? "localhost:3100"}`;
  const calendarToken = await ensureCalendarToken(userId);

  const [upcomingRsvps, saved, pastRsvps, follows] = await Promise.all([
    prisma.rsvp.findMany({
      where: {
        userId,
        status: { in: ["CONFIRMED", "WAITLISTED"] },
        event: { endsAt: { gte: now }, status: "PUBLISHED" },
      },
      orderBy: { event: { startsAt: "asc" } },
      include: {
        event: {
          select: {
            id: true, title: true, startsAt: true, endsAt: true, location: true,
            coverImage: true, club: { select: { name: true } },
          },
        },
      },
    }),
    prisma.savedEvent.findMany({
      where: { userId, event: { status: "PUBLISHED", endsAt: { gte: now } } },
      orderBy: { savedAt: "desc" },
      include: { event: { select: { id: true, title: true, startsAt: true, location: true } } },
    }),
    prisma.rsvp.findMany({
      where: { userId, event: { endsAt: { lt: now } } },
      orderBy: { event: { startsAt: "desc" } },
      take: 20,
      include: {
        event: {
          select: {
            id: true, title: true, startsAt: true,
            club: { select: { name: true } },
          },
        },
      },
    }),
    prisma.follow.findMany({
      where: { userId },
      include: { club: { select: { id: true, name: true } } },
    }),
  ]);

  // Waitlist positions for the upcoming list: one tiny indexed COUNT per
  // waitlisted row. A student holds at most a handful of queue spots, so
  // this stays a few lookups — not a pathological N+1. (A single grouped
  // query would need a raw join against a per-row cutoff; not worth it.)
  const waitlistRanks = new Map<string, number>();
  for (const r of upcomingRsvps) {
    if (r.status === "WAITLISTED") {
      waitlistRanks.set(r.id, await getWaitlistRank(r.event.id, r.createdAt));
    }
  }

  // A one-day event prints its date once; a multi-day one prints the range,
  // which already carries both ends (prepending the start date printed it twice).
  const dateLine = (startsAt: Date, endsAt: Date) =>
    isSameCampusDay(startsAt, endsAt)
      ? `${formatDate(startsAt, locale)} · ${formatEventRange(startsAt, endsAt, locale)}`
      : formatEventRange(startsAt, endsAt, locale);

  return (
    <>
      {/* Compact ink band — identity without spending a screen on it. */}
      <div className="field-ink">
        <header className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-[27px] font-extrabold leading-tight tracking-tight md:text-[32px]">
            {t("dash.title")}
          </h1>
          <p className="mt-1 text-paper/70">
            {t("dash.hi", { name: session.user.name?.split(" ")[0] ?? "" })}
          </p>
        </header>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Upcoming RSVPs — the reason the page exists, so it leads and gets
            the only real composition: an ink date block per poster. */}
        <section>
          <h2 className="text-xl font-semibold">{t("dash.upcoming")}</h2>
          {upcomingRsvps.length === 0 ? (
            <div className="mt-4 border-l-4 border-accent bg-surface px-5 py-6">
              <p>{t("dash.upcomingEmpty")}</p>
              <Link href="/events" className="btn btn-primary mt-4">
                {t("dash.browseEvents")}
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcomingRsvps.map((r) => {
                const start = new Date(r.event.startsAt);
                const waitlistRank = waitlistRanks.get(r.id) ?? 1;
                const waitlisted = r.status === "WAITLISTED";
                return (
                  <li key={r.id}>
                    <Link
                      href={`/events/${r.event.id}`}
                      className="flex items-stretch bg-surface transition-colors hover:bg-line/50"
                    >
                      {/* Ink date block: the poster's corner stamp. */}
                      <span className="flex w-16 shrink-0 flex-col items-center justify-center self-stretch bg-ink text-paper">
                        <span className="text-xs text-paper/70">
                          {formatMonthShort(start, locale)}
                        </span>
                        <span className="text-2xl font-extrabold tabular-nums">
                          {formatDayNumber(start)}
                        </span>
                      </span>

                      <div className="min-w-0 flex-1 py-4 pe-4 ps-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold">{r.event.title}</p>
                          <span
                            // tabular-nums: the queue position is a figure that
                            // sits next to the date block's day number, so both
                            // keep a fixed digit width.
                            className={
                              waitlisted
                                ? "shrink-0 bg-accent px-2 py-1 text-xs font-semibold tabular-nums text-ink"
                                : "shrink-0 bg-ink px-2 py-1 text-xs font-semibold tabular-nums text-paper"
                            }
                          >
                            {waitlisted
                              ? t("dash.waitlisted", { n: waitlistRank })
                              : t("dash.ticket")}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted">{dateLine(start, new Date(r.event.endsAt))}</p>
                        <p className="truncate text-sm text-muted">
                          {r.event.club.name} · {r.event.location}
                        </p>
                        {waitlisted && (
                          <p className="mt-1 text-sm font-semibold">
                            {t("dash.waitlistHint")}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Two columns of UNLIKE length. Every short block stacks in the left
            column and the one long list takes the right, so neither column
            ends early: splitting it the obvious way (saved left, history
            right) stranded ~550px of empty ground beside a 15-row archive,
            and a grid whose columns stop far apart is the commonest failure
            in the app-screen study (app-screens.md §4.2). The column stack and
            the gutter between columns are both 48px — one gutter (§4.1).
            Below sm everything follows the DOM order: saved, clubs, feed, and
            the archive last, since it is the lowest-value block. */}
        <div className="mt-12 grid gap-12 sm:grid-cols-2">
          <div className="space-y-12">
            <section>
              <h2 className="text-xl font-semibold">{t("dash.saved")}</h2>
              {saved.length === 0 ? (
                <div className="mt-3 bg-surface px-4 py-5 text-muted">
                  {t("dash.savedEmpty")}
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {saved.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                      <Link
                        href={`/events/${s.event.id}`}
                        className="font-medium hover:text-accent"
                      >
                        {s.event.title}
                      </Link>
                      <span className="text-sm text-muted">
                        {formatDate(s.event.startsAt, locale)} · {s.event.location}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Followed clubs — flat squares, not pills. */}
            {follows.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold">{t("dash.follows")}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {follows.map((f) => (
                    <span key={f.id} className="bg-surface px-3 py-1.5 text-sm font-medium">
                      {f.club.name}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Secret ICS feed: subscribe once, every future RSVP lands in the
                student's calendar app automatically. */}
            <CalendarSubscribe token={calendarToken} origin={feedOrigin} />
          </div>

          <section>
            <h2 className="text-xl font-semibold">{t("dash.past")}</h2>
            {pastRsvps.length === 0 ? (
              <div className="mt-3 bg-surface px-4 py-5 text-muted">
                {t("dash.pastEmpty")}
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {pastRsvps.map((r) => (
                  <li key={r.id} className="flex items-baseline justify-between gap-4 py-2.5">
                    <Link
                      href={`/events/${r.event.id}`}
                      className={
                        r.checkedInAt
                          ? "font-medium hover:text-accent"
                          : "font-medium text-muted hover:text-ink"
                      }
                    >
                      {r.event.title}
                    </Link>
                    {/* State is carried by the word, not a colour alone. */}
                    <span className="shrink-0 text-sm font-semibold">
                      {r.checkedInAt ? t("dash.attended") : t("dash.notCheckedIn")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
