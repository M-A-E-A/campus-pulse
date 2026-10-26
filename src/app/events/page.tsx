import { getCategories, getPublishedEvents } from "@/lib/queries";
import { getLocale } from "@/i18n/server";
import { EventsExplorer } from "@/components/events/EventsExplorer";

// The events page is a shell: the server passes everything the first paint
// needs (events + categories, both from the shared 60s cache in
// src/lib/queries.ts — every mutation calls revalidateTag), then the client
// explorer owns filtering.
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  // Locale first: the cached card labels (dates, day headings) are formatted
  // in it, and it is part of the cache key so locales never cross-contaminate.
  const locale = await getLocale();
  const [events, categories] = await Promise.all([
    getPublishedEvents(locale),
    getCategories(),
  ]);

  return <EventsExplorer initialEvents={events} categories={categories} />;
}
