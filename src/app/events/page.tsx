import { getCategories, getPublishedEvents } from "@/lib/queries";
import { EventsExplorer } from "@/components/events/EventsExplorer";

// The events page is a shell: the server passes everything the first paint
// needs (events + categories, both from the shared 60s cache in
// src/lib/queries.ts — every mutation calls revalidateTag), then the client
// explorer owns filtering.
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const [events, categories] = await Promise.all([
    getPublishedEvents(),
    getCategories(),
  ]);

  return <EventsExplorer initialEvents={events} categories={categories} />;
}
