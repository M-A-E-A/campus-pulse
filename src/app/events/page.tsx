import { Suspense } from "react";
import { getCategories, getPublishedEvents } from "@/lib/queries";
import { getLocale, getT, type Locale } from "@/i18n/server";
import { EventsExplorer } from "@/components/events/EventsExplorer";
import EventsStreamSkeleton from "@/components/events/EventsStreamSkeleton";

// The ink header renders in the shell: the locale dictionary is all it
// needs, so the LCP headline paints at first paint instead of waiting on
// the catalogue query (the old loading.tsx boundary held it in a hidden
// streamed segment until the query resolved, which measured as ~1s of
// element render delay on a throttled phone). The explorer, which DOES
// need the cached queries, streams in behind an explicit boundary.
export const dynamic = "force-dynamic";

/** The part that genuinely needs the catalogue: cached for 60s, so this
 *  only ever waits on the database the first hit after a mutation. */
async function EventsStream({ locale }: { locale: Locale }) {
  const [events, categories] = await Promise.all([
    getPublishedEvents(locale),
    getCategories(),
  ]);
  return <EventsExplorer initialEvents={events} categories={categories} />;
}

export default async function EventsPage() {
  // Locale first: the cached card labels (dates, day headings) are formatted
  // in it, and it is part of the cache key so locales never cross-contaminate.
  const locale = await getLocale();
  const t = await getT();

  return (
    <>
      {/* Header: an ink band, cropped by the fold, the words carrying it. */}
      <header className="field-ink" data-band style={{ animationDelay: "0.05s" }}>
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:pt-16">
          <h1 className="display-hero">{t("events.title")}</h1>
          <p className="mt-3 max-w-[46ch] text-[length:var(--step-lead)]">
            {t("events.sub")}
          </p>
        </div>
      </header>
      <Suspense fallback={<EventsStreamSkeleton />}>
        <EventsStream locale={locale} />
      </Suspense>
    </>
  );
}
