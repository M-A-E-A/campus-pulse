import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/tz";
import { submitEventAction, cancelEventAction } from "@/lib/actions/events";
import { getT } from "@/i18n/server";
import type { DictKey } from "@/i18n";

const STATUS_KEY: Record<string, DictKey> = {
  DRAFT: "org.status.draft",
  PENDING: "org.status.pending",
  PUBLISHED: "org.status.published",
  REJECTED: "org.status.rejected",
  CANCELLED: "org.status.cancelled",
};

export default async function OrganizerDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const t = await getT();

  // An organizer sees only their own club's events. Admins see everything.
  const isAdmin = session.user.role === "ADMIN";
  const memberships = await prisma.clubMember.findMany({
    where: { userId: session.user.id },
    include: { club: { select: { id: true, name: true } } },
  });
  const clubIds = memberships.map((m) => m.clubId);

  const events = await prisma.event.findMany({
    where: isAdmin ? {} : { clubId: { in: clubIds } },
    orderBy: { createdAt: "desc" },
    include: {
      club: { select: { name: true } },
      category: { select: { name: true } },
      _count: { select: { rsvps: { where: { status: "CONFIRMED" } } } },
    },
  });

  const firstClubId = clubIds[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("org.header")}</h1>
          <p className="mt-1 text-muted">
            {memberships.length > 0
              ? memberships.map((m) => m.club.name).join(" · ")
              : t("org.noClub")}
          </p>
        </div>
        {firstClubId && (
          <Link href={`/organizer/events/new?clubId=${firstClubId}`} className="btn btn-primary">
            {t("org.newEvent")}
          </Link>
        )}
      </div>

      {events.length === 0 ? (
        <div className="empty mt-10">
          <p>{t("org.empty")}</p>
        </div>
      ) : (
        <div className="card mt-8 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-line/25">
                <th className="th">{t("org.th.event")}</th>
                <th className="th">{t("org.th.date")}</th>
                <th className="th">{t("org.th.status")}</th>
                <th className="th">{t("org.th.rsvps")}</th>
                <th className="th text-end">{t("org.th.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="td">
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-xs text-muted">{e.club.name} · {e.category.name}</p>
                  </td>
                  <td className="td whitespace-nowrap text-muted">{formatDate(e.startsAt)}</td>
                  <td className="td">
                    <span className={`badge badge-${e.status.toLowerCase()}`}>
                      {t(STATUS_KEY[e.status])}
                    </span>
                    {e.status === "REJECTED" && e.rejectionReason && (
                      <p className="mt-1 max-w-52 text-xs text-danger">{e.rejectionReason}</p>
                    )}
                  </td>
                  <td className="td font-medium">
                    {e.status === "PUBLISHED" ? (
                      <Link href={`/organizer/events/${e.id}/attendees`} className="hover:text-accent-dark">
                        {e._count.rsvps}
                        {e.capacity !== null ? ` / ${e.capacity}` : ""}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {(e.status === "DRAFT" || e.status === "REJECTED") && (
                        <>
                          <Link
                            href={`/organizer/events/${e.id}/edit`}
                            className="btn btn-secondary px-3! py-1! text-xs!"
                          >
                            {t("org.action.edit")}
                          </Link>
                          <form action={submitEventAction}>
                            <input type="hidden" name="eventId" value={e.id} />
                            <button className="btn btn-primary px-3! py-1! text-xs!">
                              {t("org.action.submit")}
                            </button>
                          </form>
                        </>
                      )}
                      {e.status === "PENDING" && (
                        <span className="text-xs text-muted">{t("org.waiting")}</span>
                      )}
                      {e.status === "PUBLISHED" && (
                        <>
                          <Link
                            href={`/organizer/events/${e.id}/attendees`}
                            className="btn btn-secondary px-3! py-1! text-xs!"
                          >
                            {t("org.action.attendees")}
                          </Link>
                          <Link
                            href={`/organizer/events/${e.id}/check-in`}
                            className="btn btn-primary px-3! py-1! text-xs!"
                          >
                            {t("org.action.checkIn")}
                          </Link>
                          <form action={cancelEventAction}>
                            <input type="hidden" name="eventId" value={e.id} />
                            <button className="btn btn-danger px-3! py-1! text-xs!">{t("org.action.cancel")}</button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
