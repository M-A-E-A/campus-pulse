import { prisma } from "@/lib/prisma";
import {
  campusDayKey,
  campusDayLimit,
  formatDayNumber,
  formatMonthShort,
  formatTime,
} from "@/lib/tz";
import { getT, getLocale } from "@/i18n/server";
import type { T } from "@/i18n";
import { parseUa, referrerHost, type BrowserKind, type DeviceKind } from "@/lib/traffic";
import { creatorLogoutAction } from "@/lib/actions/creator";

/**
 * The creator's traffic console: one rolling 14-campus-day query plus an
 * all-time count, everything else grouped in JS (a campus site's two weeks
 * of page views fit comfortably in one response — no per-widget queries,
 * no cache layer to go stale). Time windows are rolling where the stat
 * says "last 24 hours"/"last 7 days" and campus days where the chart says
 * "last 14 days" — each figure states its own scope, never a bare number.
 *
 * The reporter never records `/creator*` paths, so nothing on this page
 * can inflate the numbers it is reading.
 */
const DAY_MS = 86_400_000;

/** Proper nouns stay proper nouns in every locale; "other" is copy. */
const BROWSER_LABEL: Record<BrowserKind, string | null> = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  other: null,
};

/** Referrer as the summary table groups it: direct / the site itself / host. */
function summaryRefLabel(ref: string | null, t: T): string {
  if (!ref) return t("creator.dash.direct");
  if (ref.startsWith("/")) return t("creator.dash.internal");
  return referrerHost(ref) ?? ref.slice(0, 48);
}

/** Referrer as one recorded view shows it: the actual page we came from. */
function detailRefLabel(ref: string | null, t: T): string {
  if (!ref) return t("creator.dash.direct");
  if (ref.startsWith("/")) return ref;
  return referrerHost(ref) ?? ref.slice(0, 48);
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-display text-[32px] font-extrabold leading-none tabular-nums">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

/** Share column: horizontal bar + percentage, one accent for every fill. */
function ShareBar({ percent }: { percent: number }) {
  return (
    <td className="td w-40">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 bg-line" aria-hidden="true">
          <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
        <span className="w-10 text-end text-sm tabular-nums text-muted">{percent}%</span>
      </div>
    </td>
  );
}

export default async function CreatorDashboard() {
  const t = await getT();
  const locale = await getLocale();

  // Start at the oldest of the 14 campus days so every row's campus-day
  // key lands in a chart bucket (a bare now-14*24h cut would orphan the
  // early rows of day one).
  const since = campusDayLimit(-13);
  const [allTime, rows] = await Promise.all([
    prisma.pageView.count(),
    prisma.pageView.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        path: true,
        referrer: true,
        visitorId: true,
        userAgent: true,
        createdAt: true,
      },
    }),
  ]);

  const now = Date.now();
  const views24 = rows.filter((r) => r.createdAt.getTime() >= now - DAY_MS).length;
  const weekRows = rows.filter((r) => r.createdAt.getTime() >= now - 7 * DAY_MS);
  const views7 = weekRows.length;
  const visitors7 = new Set(weekRows.map((r) => r.visitorId)).size;

  // 14 campus-day buckets, anchored at campus noon so DST shifts cannot
  // duplicate or skip a key.
  const todayNoon = new Date(`${campusDayKey(new Date())}T12:00:00Z`);
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(todayNoon.getTime() - (13 - i) * DAY_MS);
    return { key: campusDayKey(date), date };
  });
  const byDay = new Map<string, number>(days.map((d) => [d.key, 0]));
  for (const r of rows) {
    const key = campusDayKey(r.createdAt);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const counts = days.map((d) => byDay.get(d.key) ?? 0);

  const windowTotal = rows.length;
  const share = (views: number) => (windowTotal ? Math.round((views / windowTotal) * 100) : 0);

  // Top paths (14d).
  const pathCounts = new Map<string, number>();
  for (const r of rows) pathCounts.set(r.path, (pathCounts.get(r.path) ?? 0) + 1);
  const topPaths = [...pathCounts]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Referrer sources (14d): one row per source class, newest-browsing
  // internal navigation counted once as "Same site" rather than one row
  // per previous path.
  const refCounts = new Map<string, number>();
  for (const r of rows) {
    const label = summaryRefLabel(r.referrer, t);
    refCounts.set(label, (refCounts.get(label) ?? 0) + 1);
  }
  const topRefs = [...refCounts]
    .map(([source, views]) => ({ source, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  // Device × browser (14d).
  const deviceCounts = new Map<string, { device: DeviceKind; browser: BrowserKind; views: number }>();
  for (const r of rows) {
    const { device, browser } = parseUa(r.userAgent);
    const key = `${device}:${browser}`;
    const slot = deviceCounts.get(key);
    if (slot) slot.views += 1;
    else deviceCounts.set(key, { device, browser, views: 1 });
  }
  const devices = [...deviceCounts.values()].sort((a, b) => b.views - a.views).slice(0, 10);

  const recent = rows.slice(0, 20);

  const hasWindow = windowTotal > 0;
  const chartMax = Math.max(...counts, 1);
  const linePts = counts
    .map((c, i) => `${((i / (counts.length - 1)) * 100).toFixed(2)},${(30 - (c / chartMax) * 27).toFixed(2)}`)
    .join(" ");
  const areaPts = `${linePts} 100,30 0,30`;

  const firstDay = `${formatDayNumber(days[0].date)} ${formatMonthShort(days[0].date, locale)}`;
  const lastDay = `${formatDayNumber(days[13].date)} ${formatMonthShort(days[13].date, locale)}`;

  // Tone band only — the first .td's border-top already draws the header
  // rule, so a second hairline here would be doing the same job twice.
  const tableHead = "bg-line/25";

  return (
    <div>
      {/* Full-bleed ink band, same shape as the admin header so the two
          consoles read as one product. */}
      <div className="field-ink">
        <header className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-7">
          <div>
            <h1 className="text-[27px] font-extrabold leading-tight tracking-tight md:text-[32px]">
              {t("creator.dash.title")}
            </h1>
            <p className="mt-2 max-w-[62ch] text-sm text-paper/70">{t("creator.dash.lead")}</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Plain link = a real reload, so the numbers are always the
                server's latest read: no client cache to distrust. */}
            <a
              href="/creator"
              className="text-sm font-medium text-paper/70 underline-offset-4 hover:text-paper hover:underline"
            >
              {t("creator.dash.refresh")}
            </a>
            <form action={creatorLogoutAction}>
              <button className="btn btn-primary">{t("creator.dash.signOut")}</button>
            </form>
          </div>
        </header>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {allTime === 0 ? (
          <div className="empty">
            <p>{t("creator.dash.empty")}</p>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label={t("creator.dash.views24")} value={views24} />
              <Stat label={t("creator.dash.views7")} value={views7} />
              <Stat label={t("creator.dash.visitors7")} value={visitors7} />
              <Stat label={t("creator.dash.total")} value={allTime} />
            </dl>

            {hasWindow && (
              <section className="card mt-6 p-4">
                <h2 className="text-base font-bold">{t("creator.dash.daily")}</h2>
                {/* Flat accent wash (no gradient), non-scaling stroke so the
                    100×30 viewBox does not fatten the line when stretched. */}
                <svg
                  viewBox="0 0 100 30"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="mt-4 h-28 w-full"
                >
                  <polygon points={areaPts} className="fill-accent/15" />
                  <polyline
                    points={linePts}
                    fill="none"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    className="stroke-accent"
                  />
                </svg>
                <div className="mt-2 flex justify-between text-sm text-muted">
                  <span>{firstDay}</span>
                  <span>{lastDay}</span>
                </div>
              </section>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Top paths */}
              <section className="card overflow-hidden">
                <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
                  <h2 className="text-base font-bold">{t("creator.dash.paths")}</h2>
                  <span className="text-sm text-muted">{t("creator.dash.window14")}</span>
                </div>
                {topPaths.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">
                    {t("creator.dash.emptyTable")}
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={tableHead}>
                          <th className="th">{t("creator.dash.colPath")}</th>
                          <th className="th text-end">{t("creator.dash.colViews")}</th>
                          <th className="th">{t("creator.dash.colShare")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topPaths.map(({ path, views }) => (
                          <tr key={path}>
                            <td className="td">
                              <span className="block max-w-[36ch] truncate" title={path}>
                                {path}
                              </span>
                            </td>
                            <td className="td text-end font-semibold tabular-nums">{views}</td>
                            <ShareBar percent={share(views)} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Referrer sources */}
              <section className="card overflow-hidden">
                <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
                  <h2 className="text-base font-bold">{t("creator.dash.referrers")}</h2>
                  <span className="text-sm text-muted">{t("creator.dash.window14")}</span>
                </div>
                {topRefs.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">
                    {t("creator.dash.emptyTable")}
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={tableHead}>
                          <th className="th">{t("creator.dash.colSource")}</th>
                          <th className="th text-end">{t("creator.dash.colViews")}</th>
                          <th className="th">{t("creator.dash.colShare")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topRefs.map(({ source, views }) => (
                          <tr key={source}>
                            <td className="td">
                              <span className="block max-w-[28ch] truncate" title={source}>
                                {source}
                              </span>
                            </td>
                            <td className="td text-end font-semibold tabular-nums">{views}</td>
                            <ShareBar percent={share(views)} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            {/* Devices */}
            <section className="card mt-6 overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
                <h2 className="text-base font-bold">{t("creator.dash.devices")}</h2>
                <span className="text-sm text-muted">{t("creator.dash.window14")}</span>
              </div>
              {devices.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  {t("creator.dash.emptyTable")}
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={tableHead}>
                        <th className="th">{t("creator.dash.colDevice")}</th>
                        <th className="th">{t("creator.dash.colBrowser")}</th>
                        <th className="th text-end">{t("creator.dash.colViews")}</th>
                        <th className="th">{t("creator.dash.colShare")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map(({ device, browser, views }) => (
                        <tr key={`${device}:${browser}`}>
                          <td className="td">
                            {t(device === "mobile" ? "creator.dash.mobile" : "creator.dash.desktop")}
                          </td>
                          <td className="td">{BROWSER_LABEL[browser] ?? t("creator.dash.browserOther")}</td>
                          <td className="td text-end font-semibold tabular-nums">{views}</td>
                          <ShareBar percent={share(views)} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Recent */}
            <section className="card mt-6 overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
                <h2 className="text-base font-bold">{t("creator.dash.recent")}</h2>
                <span className="text-sm text-muted">{t("creator.dash.window14")}</span>
              </div>
              {recent.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  {t("creator.dash.emptyTable")}
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={tableHead}>
                        <th className="th">{t("creator.dash.colWhen")}</th>
                        <th className="th">{t("creator.dash.colPath")}</th>
                        <th className="th">{t("creator.dash.colFrom")}</th>
                        <th className="th">{t("creator.dash.colDevice")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r) => {
                        const { device, browser } = parseUa(r.userAgent);
                        return (
                          <tr key={r.id}>
                            <td className="td whitespace-nowrap tabular-nums text-muted">
                              {formatDayNumber(r.createdAt)} {formatMonthShort(r.createdAt, locale)} ·{" "}
                              {formatTime(r.createdAt)}
                            </td>
                            <td className="td">
                              <span className="block max-w-[32ch] truncate" title={r.path}>
                                {r.path}
                              </span>
                            </td>
                            <td className="td">
                              <span
                                className="block max-w-[24ch] truncate"
                                title={r.referrer ?? undefined}
                              >
                                {detailRefLabel(r.referrer, t)}
                              </span>
                            </td>
                            <td className="td whitespace-nowrap text-muted">
                              {t(device === "mobile" ? "creator.dash.mobile" : "creator.dash.desktop")} ·{" "}
                              {BROWSER_LABEL[browser] ?? t("creator.dash.browserOther")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
