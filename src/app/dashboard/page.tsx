import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWaitlistRank } from "@/lib/rsvp-core";
import { ensureCalendarToken } from "@/lib/calendar-token";
import { CalendarSubscribe } from "@/components/dashboard/CalendarSubscribe";
import { headers } from "next/headers";
import { formatDate, formatEventRange, formatMonthShort, formatDayNumber } from "@/lib/tz";
import { getT } from "@/i18n/server";

export default async function StudentDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const t = await getT();
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("dash.title")}</h1>
      <p className="mt-1 text-muted">
        {t("dash.hi", { name: session.user.name?.split(" ")[0] ?? "" })}
      </p>

      {/* Upcoming RSVPs */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t("dash.upcoming")}</h2>
        {upcomingRsvps.length === 0 ? (
          <div className="empty mt-4">
            <p>{t("dash.upcomingEmpty")}</p>
            <Link href="/events" className="btn btn-primary mt-4">{t("dash.browseEvents")}</Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcomingRsvps.map((r) => {
              const waitlistRank = waitlistRanks.get(r.id) ?? 1;
              return (
                <li key={r.id}>
                  <Link
                    href={`/events/${r.event.id}`}
                    className="card card-lift flex items-center gap-4 p-4"
                  >
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-accent-soft text-accent-dark">
                      <span className="text-xs font-bold uppercase">
                        {formatMonthShort(new Date(r.event.startsAt))}
                      </span>
                      <span className="text-xl font-bold">
                        {formatDayNumber(new Date(r.event.startsAt))}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.event.title}</p>
                      <p className="text-sm text-muted">
                        {formatDate(new Date(r.event.startsAt))} ·{" "}
                        {formatEventRange(new Date(r.event.startsAt), new Date(r.event.endsAt))}
                      </p>
                      <p className="truncate text-sm text-muted">
                        {r.event.club.name} · {r.event.location}
                      </p>
                      {r.status === "WAITLISTED" && (
                        <p className="text-xs text-[#8a6d00]">{t("dash.waitlistHint")}</p>
                      )}
                    </div>
                    {r.status === "WAITLISTED" ? (
                      <span className="badge ms-auto shrink-0 bg-[#fff3cd] text-[#8a6d00]">
                        {t("dash.waitlisted", { n: waitlistRank })}
                      </span>
                    ) : (
                      <span className="badge ms-auto shrink-0 bg-[#e6f4ea] text-[color:var(--color-success)]">
                        {t("dash.ticket")}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Saved events */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t("dash.saved")}</h2>
        {saved.length === 0 ? (
          <div className="empty mt-3">
            <p>{t("dash.savedEmpty")}</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5">
                <Link href={`/events/${s.event.id}`} className="font-medium hover:text-accent-dark">
                  {s.event.title}
                </Link>
                <span className="text-sm text-muted">
                  {formatDate(s.event.startsAt)} · {s.event.location}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Past events */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t("dash.past")}</h2>
        {pastRsvps.length === 0 ? (
          <div className="empty mt-3">
            <p>{t("dash.pastEmpty")}</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {pastRsvps.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5">
                <Link href={`/events/${r.event.id}`} className="font-medium text-muted hover:text-ink">
                  {r.event.title}
                </Link>
                <span className="text-sm">
                  {r.checkedInAt ? (
                    <span className="text-[color:var(--color-success)]">{t("dash.attended")}</span>
                  ) : (
                    <span className="text-muted">{t("dash.notCheckedIn")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Followed clubs */}
      {follows.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">{t("dash.follows")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {follows.map((f) => (
              <span key={f.id} className="badge bg-line/60 text-ink normal-case tracking-normal">
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
  );
}
