"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n/provider";

/** Instant shell while the (cached) catalogue query streams in. */
export default function EventsLoading() {
  const t = useT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10" role="status" aria-label={t("events.loading")}>
      <Skeleton className="h-10 w-40" />
      <Skeleton className="mt-3 h-5 w-72" />
      <div className="mt-6 flex flex-wrap gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card overflow-hidden">
            <Skeleton className="aspect-[16/9] w-full rounded-none" />
            <div className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
