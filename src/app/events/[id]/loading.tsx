"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/i18n/provider";

export default function EventDetailLoading() {
  const t = useT();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10" role="status" aria-label={t("events.loadingEvent")}>
      <Skeleton className="aspect-[21/9] w-full rounded-2xl!" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-4 h-10 w-3/4" />
          <Skeleton className="mt-4 h-5 w-1/2" />
          <div className="my-8 h-px w-full bg-line" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-3 h-2 w-full rounded-full!" />
          </div>
          <div className="card p-5">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-4 h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
