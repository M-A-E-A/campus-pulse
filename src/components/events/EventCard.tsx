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

export function EventCard({ event }: { event: EventCardData }) {
  const t = useT();
  const spotsLeft =
    event.capacity !== null ? event.capacity - event._count.rsvps : null;

  return (
    <Link
      href={`/events/${event.id}`}
      // Stable identity for GSAP Flip — cards keep their place across filters.
      data-flip-id={event.id}
      className="card card-lift group flex flex-col overflow-hidden"
    >
      {event.coverImage ? (
        <div className="relative aspect-[16/9] w-full bg-line/60">
          <Image
            src={event.coverImage}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className="aspect-[16/9] w-full bg-line/60"
          aria-hidden
        />
      )}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="badge bg-accent-soft text-accent-dark">{event.category.name}</span>
          <span className="text-xs text-muted">{event.club.name}</span>
        </div>
        <h3 className="text-lg leading-snug font-semibold group-hover:text-accent-dark">
          {event.title}
        </h3>
        <p className="text-sm text-muted">
          {event.dateLabel} · {event.rangeLabel}
        </p>
        <p className="text-sm text-muted">{event.location}</p>
        <p className="mt-auto pt-2 text-xs font-semibold">
          {spotsLeft === null ? (
            <span className="text-muted">{t("events.openToAll")}</span>
          ) : spotsLeft > 0 ? (
            <span>
              {spotsLeft === 1
                ? t("events.spotsLeftOne", { n: spotsLeft })
                : t("common.spotsLeft", { n: spotsLeft })}
            </span>
          ) : (
            <span className="text-danger">{t("events.full")}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
