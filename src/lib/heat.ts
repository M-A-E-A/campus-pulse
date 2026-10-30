import { CAMPUS_TZ } from "@/lib/tz";

/**
 * Campus-local time bucketing shared by the admin and organizer insights
 * pages: events are stored UTC, but the heatmap asks "which campus weekday
 * and 2-hour slot does this start in?". Extracted from the admin page so
 * both views bucket identically.
 */

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
export function campusBucket(at: Date): { day: number; slot: number } {
  let weekday = "Sun";
  let hour = 0;
  for (const p of partsFormatter.formatToParts(at)) {
    if (p.type === "weekday") weekday = p.value;
    else if (p.type === "hour") hour = Number(p.value) % 24; // some envs report midnight as 24
  }
  return { day: DAY_INDEX[weekday] ?? 0, slot: Math.floor(hour / 2) };
}
