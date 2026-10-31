import { getT } from "@/i18n/server";

/**
 * "Who's going" — the social-proof chapter under the description.
 *
 * Design contract:
 * - UPCOMING events with at least one CONFIRMED RSVP only. An ended event
 *   has the post-event band, and "going" over a past event would be a lie.
 *   Waitlisted RSVPs aren't seats and never appear.
 * - FIRST NAMES ONLY (the user's given name) — the public page stays at the
 *   disclosure level of a hallway poster. Full names and emails live behind
 *   the organizer door.
 * - 12 tiles max plus a dashed overflow tile; the count line under the stack
 *   names the first two and is the semantic text (the tiles are decoration,
 *   so the stack is aria-hidden — no screen-reader letter soup).
 * - Pure presentational server component: the page owns the query.
 */
export async function AttendeeGrid({
  firstNames,
  total,
}: {
  /** First names of the earliest CONFIRMED RSVPs, capped at 12. */
  firstNames: string[];
  /** The event's CONFIRMED count — the real number going. */
  total: number;
}) {
  const t = await getT();
  const [a, b, c] = firstNames;
  const line =
    total === 1
      ? t("detail.going.one", { a })
      : total === 2
        ? t("detail.going.two", { a, b })
        : total === 3
          ? t("detail.going.three", { a, b, c })
          : total === 4
            ? t("detail.going.moreOne", { a, b })
            : t("detail.going.more", { a, b, n: total - 2 });

  return (
    <section className="mt-14" data-going data-going-count={total}>
      <h2 className="display-chapter" data-rise>
        {t("detail.going.chapter")}
      </h2>
      {/* Overlap with logical margin (-ms) so the stack reverses itself in
          RTL; the paper ring separates overlapped tiles. Wrapping is the
          phone guard: 13 tiles are wider than a 390px column, so the stack
          becomes a small grid there instead of scrolling the page sideways.
          The overflow tile is a dashed ghost on purpose: "truncated", not
          "one more person". */}
      <div
        className="mt-5 flex flex-wrap gap-y-1 [&>*+*]:-ms-2"
        aria-hidden="true"
        data-going-stack
        data-rise
      >
        {firstNames.map((name, i) => (
          <span
            key={i}
            title={name}
            className="flex h-10 w-10 shrink-0 items-center justify-center bg-ink text-lg font-extrabold text-paper ring-2 ring-paper"
          >
            {name.charAt(0).toUpperCase()}
          </span>
        ))}
        {total > firstNames.length && (
          <span
            data-going-overflow
            className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-dashed border-ink bg-surface text-sm font-extrabold tabular-nums ring-2 ring-paper"
          >
            +{total - firstNames.length}
          </span>
        )}
      </div>
      <p className="mt-4 max-w-[38rem] text-[length:var(--step-body)] leading-relaxed" data-rise>
        {line}
      </p>
    </section>
  );
}
