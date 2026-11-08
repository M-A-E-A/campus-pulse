"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n/provider";

/** What streams in behind the shell header: the orange rail row and the
 *  card grid. The ink header above is real content now, so the skeleton
 *  starts at the rail; its own palette keeps the loading screen reading
 *  on every field. */
export default function EventsStreamSkeleton() {
  const t = useT();
  return (
    <div role="status" aria-label={t("events.loading")}>
      <div className="field-orange">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-10">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
