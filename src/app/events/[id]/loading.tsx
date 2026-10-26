"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n/provider";

/** Mirror of the poster layout: ink band, orange rail, poster grid. Skeletons
 *  keep their own palette so the loading screen reads on every field. */
export default function EventDetailLoading() {
  const t = useT();
  return (
    <div className="field-paper min-h-screen" role="status" aria-label={t("events.loadingEvent")}>
      <div className="field-ink">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:pt-16">
          <Skeleton className="h-6 w-44 rounded-none!" />
          <Skeleton className="mt-5 h-20 w-3/4 rounded-none!" />
          <Skeleton className="mt-5 h-7 w-1/2 rounded-none!" />
        </div>
      </div>
      <div className="field-orange">
        <div className="mx-auto flex max-w-6xl gap-3 px-4 py-4">
          <Skeleton className="h-6 w-56 rounded-none!" />
          <Skeleton className="ms-auto hidden h-9 w-64 rounded-none! sm:block" />
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_22rem]">
        <div>
          <Skeleton className="h-10 w-52 rounded-none!" />
          <Skeleton className="mt-5 h-4 w-full rounded-none!" />
          <Skeleton className="mt-2 h-4 w-5/6 rounded-none!" />
          <Skeleton className="mt-2 h-4 w-2/3 rounded-none!" />
          <Skeleton className="mt-14 h-10 w-64 rounded-none!" />
          <Skeleton className="mt-5 h-28 w-full rounded-none!" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-none!" />
          <Skeleton className="h-52 w-full rounded-none!" />
          <Skeleton className="h-11 w-full rounded-none!" />
        </div>
      </div>
    </div>
  );
}
