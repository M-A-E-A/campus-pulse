import Image from "next/image";
import Link from "next/link";
import { useT } from "@/i18n/provider";

export type EventCardData = {
  id: string;
  title: string;
  coverImage: string | null;
  startsAt: string;
  endsAt: string;
  location: string;
  capacity: number | null;
  club: { id: string; name: string };
  category: { id: string; name: string };
  _count: { rsvps: number };
  /** Formatted on the server (see events/page.tsx) — never re-format dates
   *  in the browser: client and server tzdata can disagree. */
  dateLabel: string;
  rangeLabel: string;
  dayLabel: string;
};

/** Mini-poster tones: the chapter colours dealt back as a hand of cards.
 *  The pale tones carry a 2px ink rule so they don't dissolve into the paper
 *  field (2px is above the detector's 1.5px outlined-box threshold); the
 *  accent tones lift --meta to full ink so their small text clears AA —
 *  0.75 opacity on accent-deep measures 4.22:1, under the 4.5:1 floor. The
 *  white surface tone appears once per six so no two paper cards land on the
 *  same row band. */
const TONES = [
  "bg-ink text-paper",
  "bg-accent text-ink [--meta:1]",
  "bg-surface text-ink border-2 border-ink",
  "bg-accent-deep text-paper [--meta:1]",
  "bg-accent-soft text-ink border-2 border-ink",
  "bg-accent text-ink [--meta:1]",
];

/** Poster heights keyed off the tone index: a wall of posters has rhythm, not
 *  one uniform box height. Derived from tone (not list position) so a poster
 *  keeps its shape when filters change. min-h + overflow-hidden keep a long
 *  title from spilling onto the next tile. */
const HEIGHTS = [
  "min-h-[420px]",
  "min-h-[340px]",
  "min-h-[380px]",
  "min-h-[420px]",
  "min-h-[340px]",
  "min-h-[380px]",
];

export function EventCard({
  event,
  dealIndex,
}: {
  event: EventCardData;
  /** The event's index in the server's initial list — NOT its position in
   *  the filtered result: filters only remove cards, they never re-deal. */
  dealIndex: number;
}) {
  const t = useT();
  // A dealt cycle, not a hash: the wall always mixes tones and orange lands
  // early, instead of a random hand that can come out all black.
  const tone = dealIndex % TONES.length;
  const spotsLeft =
    event.capacity !== null ? event.capacity - event._count.rsvps : null;

  return (
    <Link
      href={`/events/${event.id}`}
      // Stable identity for GSAP Flip — posters keep their place across filters.
      data-flip-id={event.id}
      className={`${TONES[tone]} ${HEIGHTS[tone]} flex flex-col justify-between overflow-hidden p-6 transition-[filter] hover:brightness-95`}
    >
      {event.coverImage && (
        <div className="relative -mx-6 -mt-6 mb-5 h-40 w-full overflow-hidden">
          <Image
            src={event.coverImage}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      )}

      {/* Stacked, not side by side: the top block stays tidy however long the
          club and category run. Body text at the body step (16px), not the
          small step — the inspector flags 14px as the running size. */}
      <div className="space-y-0.5">
        <span className="block font-semibold">{event.club.name}</span>
        <span className="block opacity-[var(--meta,0.75)]">
          {event.category.name}
        </span>
      </div>

      {/* Title at the full card measure — a capped measure forced real long
          event names onto three lines (headline-lines). 24px keeps every
          title above the 16px body step while wrapping at two lines. */}
      <h3 className="w-full text-2xl font-extrabold leading-[1.05] tracking-tight">
        {event.title}
      </h3>

      <div className="space-y-1">
        {/* Overnight / multi-day ranges already open with the full start
            date — printing dateLabel again doubled it ("Fri, 30 Oct 2026 ·
            Fri, 30 Oct 2026 22:00 – …"). */}
        <p className="font-semibold">
          {event.rangeLabel.startsWith(event.dateLabel)
            ? event.rangeLabel
            : `${event.dateLabel} · ${event.rangeLabel}`}
        </p>
        <p className="opacity-[var(--meta,0.75)]">{event.location}</p>
        <p className="pt-1 font-semibold">
          {spotsLeft === null ? (
            <span className="opacity-[var(--meta,0.75)]">{t("events.openToAll")}</span>
          ) : spotsLeft > 0 ? (
            <span>
              {spotsLeft === 1
                ? t("events.spotsLeftOne", { n: spotsLeft })
                : t("common.spotsLeft", { n: spotsLeft })}
            </span>
          ) : (
            <span className="line-through">{t("events.full")}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
