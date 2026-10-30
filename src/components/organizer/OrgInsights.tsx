"use client";

import { useT } from "@/i18n/provider";
import type { DictKey } from "@/i18n";

export type WeekBar = { key: string; label: string; count: number };
export type VelocityBucket = { key: DictKey; count: number };
export type NoShowRow = {
  id: string;
  title: string;
  date: string;
  registered: number;
  attended: number;
};

/**
 * Organizer analytics blocks: registrations by week, check-in velocity
 * (minutes from event start to door scan) and a per-event no-show list.
 * Server precomputes every label and number — this component only renders +
 * localizes, exactly like <Insights>. Bars are plain divs with inline
 * heights (no canvas): RTL flips the rows for free, reduced motion is a
 * non-issue, and each bar carries its full sentence as a native tooltip.
 */
export function OrgInsights({
  weeks,
  velocity,
  noShows,
}: {
  /** Campus-local weeks (Monday key) ascending, zero-filled. */
  weeks: WeekBar[];
  /** Fixed bucket order: before / 0–15 / 15–30 / 30–60 / 60+. */
  velocity: VelocityBucket[];
  /** Recent past events, newest first. */
  noShows: NoShowRow[];
}) {
  const t = useT();

  const maxWeek = Math.max(0, ...weeks.map((w) => w.count));
  const peakWeek = weeks.find((w) => w.count === maxWeek && maxWeek > 0);

  const maxVelocity = Math.max(0, ...velocity.map((v) => v.count));
  const peakVelocity = velocity.find((v) => v.count === maxVelocity && maxVelocity > 0);

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      {/* Registration trend — one bar per campus week, accent fill on a
          baseline axis; empty weeks keep their slot so the time axis reads. */}
      <section className="card p-5">
        <h2 className="text-base font-bold">{t("oins.reg.title")}</h2>
        <div className="mt-5 flex h-32 items-end gap-1 border-b border-line">
          {weeks.map((w) => (
            <div
              key={w.key}
              className="min-w-0 flex-1 rounded-t-[2px] bg-accent"
              style={{
                height: maxWeek > 0 ? `${(w.count / maxWeek) * 100}%` : "0%",
              }}
              title={t("oins.reg.week", { week: w.label, count: w.count })}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-sm text-muted">
          <span>{weeks[0]?.label}</span>
          <span>{weeks[weeks.length - 1]?.label}</span>
        </div>
        {peakWeek && (
          <p className="mt-3 text-sm text-muted">
            {t("oins.reg.peak", { week: peakWeek.label, count: maxWeek })}
          </p>
        )}
      </section>

      {/* Velocity — how fast the room fills once doors open. */}
      <section className="card p-5">
        <h2 className="text-base font-bold">{t("oins.vel.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("oins.vel.sub")}</p>
        <ul className="mt-4 space-y-3">
          {velocity.map((v) => (
            <li key={v.key} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3">
              <span className="truncate text-sm">{t(v.key)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-line/60">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{
                    width: maxVelocity > 0 ? `${(v.count / maxVelocity) * 100}%` : "0%",
                  }}
                />
              </span>
              <span className="text-end text-sm tabular-nums">{v.count}</span>
            </li>
          ))}
        </ul>
        {peakVelocity && (
          <p className="mt-3 text-sm text-muted">
            {t("oins.vel.peak", { bucket: t(peakVelocity.key), count: maxVelocity })}
          </p>
        )}
      </section>

      {/* No-shows — who never made it, per finished event. */}
      <section className="card p-5 md:col-span-2">
        <h2 className="text-base font-bold">{t("oins.noshow.title")}</h2>
        <ul className="mt-3">
          {noShows.map((r) => {
            const rate =
              r.registered > 0
                ? Math.round(((r.registered - r.attended) / r.registered) * 100)
                : null;
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="text-sm text-muted">{r.date}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm tabular-nums">
                  <span className="whitespace-nowrap text-muted">
                    {t("oins.noshow.attended", { attended: r.attended, registered: r.registered })}
                  </span>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line/60" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{
                        width:
                          r.registered > 0 ? `${(r.attended / r.registered) * 100}%` : "0%",
                      }}
                    />
                  </span>
                  <span className="w-28 whitespace-nowrap text-end font-semibold">
                    {rate === null ? "—" : t("oins.noshow.rate", { rate })}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
