import Link from "next/link";
import { getUpcomingStrip } from "@/lib/queries";
import { getT } from "@/i18n/server";

/** Next six published events, from the shared cached catalogue. */
export async function UpcomingStrip() {
  const [events, t] = await Promise.all([getUpcomingStrip(), getT()]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">{t("landing.comingUp")}</h2>
          <p className="mt-1 text-muted">{t("landing.comingUpSub")}</p>
        </div>
        <Link href="/events" className="shrink-0 text-sm font-semibold text-accent-dark hover:underline">
          {t("landing.allEvents")}
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="empty mt-8">
          <p>{t("landing.noEvents")}</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className="card card-lift flex h-full flex-col p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="badge bg-accent-soft text-accent-dark">{e.categoryName}</span>
                  <span className="text-xs text-muted">{e.clubName}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold leading-snug">{e.title}</h3>
                <p className="mt-auto pt-3 text-sm text-muted">
                  {e.dateLabel} · {e.timeLabel}
                  {e.spotsLeft !== null && <> · {t("common.spotsLeft", { n: e.spotsLeft })}</>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
