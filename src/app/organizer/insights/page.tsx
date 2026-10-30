import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { campusBucket } from "@/lib/heat";
import { campusDayKey, formatDate, formatDayNumber, formatMonthShort } from "@/lib/tz";
import { getT, getLocale, type Locale } from "@/i18n/server";
import { Insights, type HeatCell } from "@/components/admin/Insights";
import {
  OrgInsights,
  type NoShowRow,
  type VelocityBucket,
  type WeekBar,
} from "@/components/organizer/OrgInsights";

/**
 * Organizer analytics — the per-club answer to /admin/insights. The heatmap
 * and its stat row ARE the admin <Insights> fed with club-scoped data (the
 * query mirrors the dashboard: every club the session user organizes;
 * admins see all). Beneath it, OrgInsights carries the three numbers a
 * club actually asks about: registrations over time, check-in velocity and
 * who never showed up.
 */

const emptyCell = (): HeatCell => ({ events: 0, checkIns: 0 });

/** Velocity buckets: minutes from event start (startsAt) to the door scan. */
const VELOCITY_KEYS = [
  "oins.vel.before",
  "oins.vel.0_15",
  "oins.vel.15_30",
  "oins.vel.30_60",
  "oins.vel.60p",
] as const;

/** Monday of the campus-local week containing `dayKey` (YYYY-MM-DD). */
function mondayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7));
  return utc.toISOString().slice(0, 10);
}

function addDaysKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "14 Mar" for a campus-week key, in the request locale. */
function weekLabel(dayKey: string, locale: Locale): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return `${formatDayNumber(utc)} ${formatMonthShort(utc, locale)}`;
}

export default async function OrganizerInsightsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const t = await getT();
  const locale = await getLocale();

  const isAdmin = session.user.role === "ADMIN";
  const memberships = await prisma.clubMember.findMany({
    where: { userId: session.user.id },
    select: { clubId: true },
  });
  const clubIds = memberships.map((m) => m.clubId);

  const now = new Date();
  const since = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

  // Past published events of the organizer's clubs with their CONFIRMED
  // RSVPs; each rsvp carries createdAt + checkedInAt so one filtered include
  // feeds all four views (heatmap, weeks, velocity, no-shows).
  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      endsAt: { lt: now },
      startsAt: { gte: since },
      ...(isAdmin ? {} : { clubId: { in: clubIds } }),
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      rsvps: {
        where: { status: "CONFIRMED" },
        select: { createdAt: true, checkedInAt: true },
      },
    },
    orderBy: { startsAt: "desc" },
  });

  // matrix[weekday 0=Sun..6=Sat][slot 0..11] — campusBucket from lib/heat,
  // so this heatmap buckets exactly like /admin/insights.
  const matrix: HeatCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 12 }, emptyCell)
  );
  let totalRsvps = 0;
  let totalCheckIns = 0;
  const signupCounts = new Map<string, number>(); // monday key → count
  const velocity: VelocityBucket[] = VELOCITY_KEYS.map((key) => ({ key, count: 0 }));
  const noShows: NoShowRow[] = [];

  for (const e of events) {
    const { day, slot } = campusBucket(e.startsAt);
    let attended = 0;
    for (const r of e.rsvps) {
      if (r.createdAt >= since) {
        const key = mondayKey(campusDayKey(r.createdAt));
        signupCounts.set(key, (signupCounts.get(key) ?? 0) + 1);
      }
      if (r.checkedInAt !== null) {
        attended += 1;
        const mins = (r.checkedInAt.getTime() - e.startsAt.getTime()) / 60_000;
        const idx = mins < 0 ? 0 : mins < 15 ? 1 : mins < 30 ? 2 : mins < 60 ? 3 : 4;
        velocity[idx].count += 1;
      }
    }
    matrix[day][slot].events += 1;
    matrix[day][slot].checkIns += attended;
    totalRsvps += e.rsvps.length;
    totalCheckIns += attended;
    if (noShows.length < 6) {
      noShows.push({
        id: e.id,
        title: e.title,
        date: formatDate(e.startsAt, locale),
        registered: e.rsvps.length,
        attended,
      });
    }
  }

  let maxCheckIns = 0;
  for (const row of matrix) {
    for (const cell of row) {
      if (cell.checkIns > maxCheckIns) maxCheckIns = cell.checkIns;
    }
  }

  // Zero-filled campus weeks, Monday keys, oldest → newest. ISO keys
  // compare lexicographically, so `<=` is a valid date comparison.
  const weeks: WeekBar[] = [];
  for (
    let k = mondayKey(campusDayKey(since));
    k <= mondayKey(campusDayKey(now));
    k = addDaysKey(k, 7)
  ) {
    weeks.push({ key: k, label: weekLabel(k, locale), count: signupCounts.get(k) ?? 0 });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/organizer" className="text-sm text-muted hover:text-ink">
        {t("org.back")}
      </Link>

      <div className="mt-6">
        <h1 className="text-[27px] font-extrabold leading-tight tracking-tight md:text-[32px]">
          {t("oins.header")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("oins.sub")}</p>
      </div>

      {events.length === 0 ? (
        <div className="empty">{t("oins.empty")}</div>
      ) : (
        <>
          <Insights
            matrix={matrix}
            totals={{
              events: events.length,
              rsvps: totalRsvps,
              checkIns: totalCheckIns,
            }}
            maxCheckIns={maxCheckIns}
          />
          <OrgInsights weeks={weeks} velocity={velocity} noShows={noShows} />
        </>
      )}
    </div>
  );
}
