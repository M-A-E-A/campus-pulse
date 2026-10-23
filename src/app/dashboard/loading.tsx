import { Skeleton } from "@/components/ui/Skeleton";
import { getT } from "@/i18n/server";

export default async function DashboardLoading() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10" role="status" aria-label={t("dash.loading")}>
      <Skeleton className="h-9 w-44" />
      <Skeleton className="mt-3 h-5 w-64" />
      <Skeleton className="mt-10 h-6 w-32" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="card flex items-center gap-4 p-4">
            <Skeleton className="h-14 w-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="mt-10 h-6 w-32" />
      <Skeleton className="mt-4 h-24 w-full" />
    </div>
  );
}
