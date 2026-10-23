"use client";

import { useT } from "@/i18n/provider";
import type { DictKey } from "@/i18n";

export type HeatCell = { events: number; checkIns: number };

/**
 * Attendance heatmap: 7 rows (Mon → Sun) × 12 two-hour columns, bucketed by
 * campus-local time on the server. Client only renders + localizes.
 */
export function Insights({
  matrix,
  totals,
  maxCheckIns,
}: {
  /** [weekday 0=Sun..6=Sat][slot 0..11] */
  matrix: HeatCell[][];
  totals: { events: number; rsvps: number; checkIns: number };
  maxCheckIns: number;
}) {
  const t = useT();

  // Display order: Mon … Sun. Matrix is indexed Sun=0.
  const ROW_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const DAY_KEYS: DictKey[] = [
    "ins.day.sun",
    "ins.day.mon",
    "ins.day.tue",
    "ins.day.wed",
    "ins.day.thu",
    "ins.day.fri",
    "ins.day.sat",
  ];
  // Column labels: every 2 slots, plus the axis end (22:00).
  const COLUMN_KEYS: Record<number, DictKey> = {
    0: "ins.hour.00",
    2: "ins.hour.04",
    4: "ins.hour.08",
    6: "ins.hour.12",
    8: "ins.hour.16",
    10: "ins.hour.20",
    11: "ins.hour.22",
  };

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const slotRange = (slot: number) => ({
    start: `${pad2(slot * 2)}:00`,
    end: `${pad2((slot * 2 + 2) % 24)}:00`,
  });

  // Cell tint: check-in intensity; events without check-ins get a light wash.
  const cellAlpha = (cell: HeatCell): number => {
    if (cell.checkIns > 0) {
      return maxCheckIns > 0
        ? 0.08 + 0.92 * (cell.checkIns / maxCheckIns)
        : 0.15;
    }
    return cell.events > 0 ? 0.15 : 0;
  };

  // Busiest cell — by check-ins, falling back to events when none recorded.
  let peak: { day: number; slot: number } | null = null;
  let best = 0;
  for (let d = 0; d < 7; d++) {
    for (let s = 0; s < 12; s++) {
      const cell = matrix[d]?.[s];
      if (!cell) continue;
      const score = maxCheckIns > 0 ? cell.checkIns : cell.events;
      if (score > best) {
        best = score;
        peak = { day: d, slot: s };
      }
    }
  }

  const rate =
    totals.rsvps > 0
      ? `${Math.round((totals.checkIns / totals.rsvps) * 100)}%`
      : "—";

  const stats: { label: string; value: string | number }[] = [
    { label: t("ins.stat.events"), value: totals.events },
    { label: t("ins.stat.rsvps"), value: totals.rsvps },
    { label: t("ins.stat.checkins"), value: totals.checkIns },
    { label: t("ins.stat.rate"), value: rate },
  ];

  return (
    <div className="mt-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="card mt-6 p-4 sm:p-5">
        <h2 className="text-base font-semibold">{t("ins.gridTitle")}</h2>

        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[620px] grid-cols-[auto_repeat(12,minmax(0,1fr))] gap-1">
            {/* Column hour labels */}
            <span aria-hidden />
            {Array.from({ length: 12 }, (_, slot) => (
              <span
                key={`col-${slot}`}
                className="text-center text-[10px] leading-5 text-muted tabular-nums"
              >
                {COLUMN_KEYS[slot] ? t(COLUMN_KEYS[slot]) : ""}
              </span>
            ))}

            {/* Rows: Mon → Sun */}
            {ROW_ORDER.map((day) => (
              <div key={`row-${day}`} className="contents">
                <span className="me-2 self-center text-end text-xs text-muted">
                  {t(DAY_KEYS[day])}
                </span>
                {Array.from({ length: 12 }, (_, slot) => {
                  const cell = matrix[day]?.[slot] ?? { events: 0, checkIns: 0 };
                  const alpha = cellAlpha(cell);
                  const { start, end } = slotRange(slot);
                  const label = t("ins.cell", {
                    day: t(DAY_KEYS[day]),
                    start,
                    end,
                    events: cell.events,
                    checkIns: cell.checkIns,
                  });
                  return (
                    <div
                      key={`cell-${day}-${slot}`}
                      title={cell.events > 0 ? label : undefined}
                      aria-label={cell.events > 0 ? label : undefined}
                      className={
                        alpha === 0
                          ? "h-7 rounded-[3px] bg-line/30"
                          : "h-7 rounded-[3px] transition-colors"
                      }
                      style={
                        alpha === 0
                          ? undefined
                          : { backgroundColor: `rgba(255,77,0,${alpha.toFixed(3)})` }
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend + peak */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span>{t("ins.legend.low")}</span>
            <span
              aria-hidden
              className="h-2.5 w-28 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, rgba(255,77,0,0.08), rgba(255,77,0,1))",
              }}
            />
            <span>{t("ins.legend.high")}</span>
            <span className="ms-1">· {t("ins.legend.title")}</span>
          </div>

          {peak && (
            <p className="font-medium text-ink">
              {t("ins.peak", {
                day: t(DAY_KEYS[peak.day]),
                time: `${slotRange(peak.slot).start}–${slotRange(peak.slot).end}`,
              })}
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">{t("ins.footnote")}</p>
    </div>
  );
}
