import { Skeleton } from "@/components/ui/Skeleton";
import { getT } from "@/i18n/server";

export default async function OrganizerLoading() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10" role="status" aria-label={t("org.loading")}>
      <Skeleton className="h-9 w-44" />
      <Skeleton className="mt-3 h-5 w-72" />
      <div className="card mt-8 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-line p-4 first:border-t-0">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="mt-2 h-3.5 w-1/4" />
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
