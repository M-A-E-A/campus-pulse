import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/tz";
import { approveEventAction } from "@/lib/actions/admin";
import { getT } from "@/i18n/server";
import { RejectForm } from "./RejectForm";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  const t = await getT();

  const pending = await prisma.event.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      club: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("admin.header")}</h1>
      <nav className="mt-2 flex gap-4 text-sm">
        <Link href="/admin" className="font-semibold text-accent-dark">{t("admin.nav.queue")}</Link>
        <Link href="/admin/clubs" className="text-muted hover:text-ink">{t("admin.nav.clubs")}</Link>
        <Link href="/admin/categories" className="text-muted hover:text-ink">{t("admin.nav.categories")}</Link>
        <Link href="/admin/insights" className="text-muted hover:text-ink">{t("admin.nav.insights")}</Link>
      </nav>

      <h2 className="mt-8 text-xl font-semibold">
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{e.title}</p>
                  <p className="text-sm text-muted">
                    {e.club.name} · {e.category.name} · {t("admin.queue.submitted", { date: formatDate(e.createdAt) })}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {formatDate(e.startsAt)} · {e.location}
                    {e.capacity !== null && t("admin.queue.capacity", { n: e.capacity })}
                  </p>
                </div>
                <Link
                  href={`/events/${e.id}`}
                  className="btn btn-secondary py-1.5! text-sm!"
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
    </div>
  );
}
