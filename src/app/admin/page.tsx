import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/tz";
import { approveEventAction } from "@/lib/actions/admin";
import { getT, getLocale } from "@/i18n/server";
import { AdminHeader } from "./AdminHeader";
import { RejectForm } from "./RejectForm";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  const t = await getT();
  const locale = await getLocale();

  const pending = await prisma.event.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      club: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  return (
    <>
      <AdminHeader titleKey="admin.header" active="/admin" />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="text-lg font-semibold">
          {t("admin.queue.header", { n: pending.length })}
        </h2>

        {pending.length === 0 ? (
          <div className="empty mt-4">
            <p>{t("admin.queue.empty")}</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {pending.map((e) => (
              <li key={e.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  {/* `min-w-0 flex-1` keeps the preview action pinned to the
                      title's line instead of dropping it between the meta and
                      the description once the block stops being narrower than
                      the card (which is what happened on a phone). */}
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold">{e.title}</p>
                    <p className="text-sm text-muted">
                      {e.club.name} · {e.category.name} ·{" "}
                      {t("admin.queue.submitted", {
                        date: formatDate(e.createdAt, locale),
                      })}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {formatDate(e.startsAt, locale)} · {e.location}
                      {e.capacity !== null && t("admin.queue.capacity", { n: e.capacity })}
                    </p>
                  </div>
                  <Link
                    href={`/events/${e.id}`}
                    className="btn btn-secondary shrink-0 py-1.5! text-sm!"
                  >
                    {t("admin.queue.preview")}
                  </Link>
                </div>

                <p className="mt-3 whitespace-pre-line text-sm">{e.description}</p>

                <div className="mt-4 flex flex-wrap items-start gap-3">
                  <form action={approveEventAction}>
                    <input type="hidden" name="eventId" value={e.id} />
                    <button className="btn btn-primary">{t("admin.queue.approve")}</button>
                  </form>
                  <RejectForm eventId={e.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
