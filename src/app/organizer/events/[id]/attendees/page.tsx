import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth, isClubOrganizer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime } from "@/lib/tz";
import { getT } from "@/i18n/server";

export default async function AttendeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const t = await getT();

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { club: { select: { id: true, name: true } } },
  });
  if (!event) notFound();

  const allowed = await isClubOrganizer(session.user.id, event.clubId);
  if (!allowed) redirect("/organizer");

  const rsvps = await prisma.rsvp.findMany({
    where: { eventId: event.id, status: "CONFIRMED" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const attended = rsvps.filter((r) => r.checkedInAt !== null).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/organizer" className="text-sm text-muted hover:text-ink">{t("org.back")}</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="mt-1 text-muted">
            {formatDate(event.startsAt)} · {event.club.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/organizer/events/${event.id}/check-in`} className="btn btn-primary">
            {t("org.attendees.openCheckIn")}
          </Link>
          <a href={`/api/events/${event.id}/attendees.csv`} className="btn btn-secondary">
            {t("org.attendees.exportCsv")}
          </a>
          <Link href={`/organizer/events/${event.id}/pulse`} className="btn btn-secondary">
            {t("pulse.open")}
          </Link>
        </div>
      </div>

      {/* The number the club actually cares about. */}
      <div className="mt-6 flex gap-3">
        <div className="card flex-1 p-5">
          <p className="text-sm text-muted">{t("org.attendees.rsvps")}</p>
          <p className="text-3xl font-bold">{rsvps.length}
            {event.capacity !== null && <span className="text-lg text-muted"> / {event.capacity}</span>}
          </p>
        </div>
        <div className="card flex-1 p-5">
          <p className="text-sm text-muted">{t("org.attendees.showedUp")}</p>
          <p className="text-3xl font-bold">{attended}</p>
        </div>
        <div className="card flex-1 p-5">
          <p className="text-sm text-muted">{t("org.attendees.rate")}</p>
          <p className="text-3xl font-bold">
            {rsvps.length > 0 ? Math.round((attended / rsvps.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {rsvps.length === 0 ? (
        <div className="empty mt-8">
          <p>{t("org.attendees.empty")}</p>
        </div>
      ) : (
        <div className="card mt-8 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-line/25">
                <th className="th">{t("org.attendees.th.name")}</th>
                <th className="th">{t("org.attendees.th.email")}</th>
                <th className="th">{t("org.attendees.th.rsvpDate")}</th>
                <th className="th">{t("org.attendees.th.checkedIn")}</th>
              </tr>
            </thead>
            <tbody>
              {rsvps.map((r) => (
                <tr key={r.id}>
                  <td className="td font-medium">{r.user.name}</td>
                  <td className="td text-muted">{r.user.email}</td>
                  <td className="td text-muted">{formatDate(r.createdAt)}</td>
                  <td className="td">
                    {r.checkedInAt ? (
                      <span className="badge bg-[#e6f4ea] text-[color:var(--color-success)]">
                        {formatTime(r.checkedInAt)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
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
