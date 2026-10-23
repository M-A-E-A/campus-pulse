import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CAMPUS_TZ } from "@/lib/tz";
import { getT } from "@/i18n/server";
import { Insights, type HeatCell } from "@/components/admin/Insights";

/** en-GB short weekday → JS day index (0 = Sun … 6 = Sat). */
const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Events are stored UTC; bucket them by campus-local weekday + hour.
const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAMPUS_TZ,
  weekday: "short",
  hour: "2-digit",
  hour12: false,
});

/** Campus-local weekday (0 = Sun) and 2-hour slot (0..11) for an instant. */
function campusBucket(at: Date): { day: number; slot: number } {
  let weekday = "Sun";
  let hour = 0;
  for (const p of partsFormatter.formatToParts(at)) {
    if (p.type === "weekday") weekday = p.value;
    else if (p.type === "hour") hour = Number(p.value) % 24; // some envs report midnight as 24
  }
  return { day: DAY_INDEX[weekday] ?? 0, slot: Math.floor(hour / 2) };
}

const emptyCell = (): HeatCell => ({ events: 0, checkIns: 0 });

export default async function AdminInsightsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  const t = await getT();

  const now = new Date();
  const since = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

  // Past published events with their CONFIRMED RSVPs; each rsvp carries
  // checkedInAt so one filtered include yields both counts.
  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      endsAt: { lt: now },
      startsAt: { gte: since },
    },
    select: {
      startsAt: true,
      rsvps: {
        where: { status: "CONFIRMED" },
        select: { checkedInAt: true },
      },
    },
  });

  // matrix[weekday 0=Sun..6=Sat][slot 0..11]
  const matrix: HeatCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 12 }, emptyCell)
  );
  let totalRsvps = 0;
  let totalCheckIns = 0;
  for (const e of events) {
    const { day, slot } = campusBucket(e.startsAt);
    const checkIns = e.rsvps.filter((r) => r.checkedInAt !== null).length;
    matrix[day][slot].events += 1;
    matrix[day][slot].checkIns += checkIns;
    totalRsvps += e.rsvps.length;
    totalCheckIns += checkIns;
  }

  let maxCheckIns = 0;
  for (const row of matrix) {
    for (const cell of row) {
      if (cell.checkIns > maxCheckIns) maxCheckIns = cell.checkIns;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("ins.header")}</h1>
      <nav className="mt-2 flex gap-4 text-sm">
        <Link href="/admin" className="text-muted hover:text-ink">{t("admin.nav.queue")}</Link>
        <Link href="/admin/clubs" className="text-muted hover:text-ink">{t("admin.nav.clubs")}</Link>
        <Link href="/admin/categories" className="text-muted hover:text-ink">{t("admin.nav.categories")}</Link>
        <Link href="/admin/insights" className="font-semibold text-accent-dark">{t("admin.nav.insights")}</Link>
      </nav>

      <p className="mt-2 text-sm text-muted">{t("ins.sub")}</p>

      <Insights
        matrix={matrix}
        totals={{
          events: events.length,
          rsvps: totalRsvps,
          checkIns: totalCheckIns,
        }}
        maxCheckIns={maxCheckIns}
      />
    </div>
  );
}
