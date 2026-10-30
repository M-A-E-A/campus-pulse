import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/tz";
import { submitEventAction, cancelEventAction } from "@/lib/actions/events";
import { getT, getLocale } from "@/i18n/server";
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
  const locale = await getLocale();

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
    <>
      {/* Compact ink band — the same identity as the student dashboard, so the
          two screens read as one product rather than two templates. */}
      <div className="field-ink">
        <header className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4 px-4 py-8">
          <div className="min-w-0">
            <h1 className="text-[27px] font-extrabold leading-tight tracking-tight md:text-[32px]">
              {t("org.header")}
            </h1>
            <p className="mt-1 text-sm text-paper/70">
              {memberships.length > 0
                ? memberships.map((m) => m.club.name).join(" · ")
                : t("org.noClub")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href="/organizer/insights"
              className="btn btn-secondary border-paper/40 text-paper hover:border-paper"
            >
              {t("org.insights")}
            </Link>
            {firstClubId && (
              <Link
                href={`/organizer/events/new?clubId=${firstClubId}`}
                className="btn btn-primary"
              >
                {t("org.newEvent")}
              </Link>
            )}
          </div>
        </header>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {events.length === 0 ? (
          <div className="empty">{t("org.empty")}</div>
        ) : (
          /* The frame scrolls, the page never does: below 640px the table
             becomes two-line rows (identity + count on line 1, the remaining
             fields and the action on line 2) so nothing is clipped off the
             right edge — the old `overflow-hidden` made RSVPs and every action
             unreachable on a phone. Explicit roles keep the table semantics
             that changing `display` would otherwise drop. */
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[720px] max-sm:min-w-0 max-sm:block"
              role="table"
            >
              <thead className="max-sm:hidden" role="rowgroup">
                <tr role="row">
                  <th className="th w-[34%]" role="columnheader">
                    {t("org.th.event")}
                  </th>
                  <th className="th" role="columnheader">
                    {t("org.th.date")}
                  </th>
                  <th className="th" role="columnheader">
                    {t("org.th.status")}
                  </th>
                  <th className="th text-end" role="columnheader">
                    {t("org.th.rsvps")}
                  </th>
                  <th className="th text-end" role="columnheader">
                    {t("org.th.actions")}
                  </th>
                </tr>
              </thead>
              <tbody
                className="max-sm:block"
                role="rowgroup"
              >
                {events.map((e) => (
                  <tr
                    key={e.id}
                    role="row"
                    /* Below 640px each row is placed on an explicit grid rather
                       than wrapped: `flex-1` gives the identity cell a basis of
                       zero, so nothing ever forced a wrap and every field
                       stayed on "line 1" while the identity column starved to
                       ~100px (the club subline ran to five lines). Explicit
                       placement puts the key number on the identity's line and
                       the remaining fields on line 2. Grid column 1 is the
                       inline start in both LTR and RTL, so this is direction
                       safe. */
                    className="max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:items-baseline max-sm:gap-x-3 max-sm:gap-y-1.5 max-sm:border-t max-sm:border-line max-sm:py-3.5 max-sm:first:border-t-0"
                  >
                    {/* Identity: the widest column, and the only one in full ink. */}
                    <td
                      className="td max-sm:col-start-1 max-sm:row-start-1 max-sm:min-w-0 max-sm:border-t-0 max-sm:p-0"
                      role="cell"
                    >
                      <p className="font-semibold">{e.title}</p>
                      <p className="text-[13px] text-muted">
                        {e.club.name} · {e.category.name}
                      </p>
                    </td>

                    <td
                      className="td whitespace-nowrap text-muted max-sm:col-start-1 max-sm:row-start-2 max-sm:border-t-0 max-sm:p-0 max-sm:text-[13px]"
                      role="cell"
                    >
                      {formatDate(e.startsAt, locale)}
                    </td>

                    {/* One status mark per row: the word carries the state, the
                        chip only tints it (never a tag AND a badge). */}
                    <td
                      className="td max-sm:col-start-2 max-sm:row-start-2 max-sm:justify-self-end max-sm:border-t-0 max-sm:p-0"
                      role="cell"
                    >
                      <span className={`badge badge-${e.status.toLowerCase()}`}>
                        {t(STATUS_KEY[e.status])}
                      </span>
                      {e.status === "REJECTED" && e.rejectionReason && (
                        <p className="mt-1 max-w-52 text-[13px] text-danger">
                          {e.rejectionReason}
                        </p>
                      )}
                    </td>

                    {/* Count in ink over its grey denominator, both on the same
                        right edge (7.5) — never left-aligned, never wrapping. */}
                    <td
                      className="td text-end max-sm:col-start-2 max-sm:row-start-1 max-sm:justify-self-end max-sm:border-t-0 max-sm:p-0"
                      role="cell"
                    >
                      {e.status === "PUBLISHED" ? (
                        <Link
                          href={`/organizer/events/${e.id}/attendees`}
                          className="whitespace-nowrap hover:text-accent-dark"
                        >
                          <span className="font-semibold text-ink tabular-nums">
                            {e._count.rsvps}
                          </span>
                          {e.capacity !== null && (
                            <span className="text-muted tabular-nums">
                              {" /" + e.capacity}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* One fixed trailing column at the same pitch for every
                        row: ink text actions on a single line, so rows never
                        change height (7.8). A pending event carries no action —
                        its chip already says so, and repeating it would be a
                        tag and a badge saying the same thing (7.6). */}
                    <td
                      className="td text-end max-sm:col-span-2 max-sm:row-start-3 max-sm:border-t-0 max-sm:p-0"
                      role="cell"
                    >
                      <div className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1 whitespace-nowrap max-sm:min-h-[40px] max-sm:items-center">
                        {(e.status === "DRAFT" || e.status === "REJECTED") && (
                          <>
                            <Link
                              href={`/organizer/events/${e.id}/edit`}
                              className="text-[13px] font-medium text-ink hover:underline"
                            >
                              {t("org.action.edit")}
                            </Link>
                            <form action={submitEventAction} className="inline-flex">
                              <input type="hidden" name="eventId" value={e.id} />
                              <button
                                type="submit"
                                className="text-[13px] font-semibold text-ink hover:underline"
                              >
                                {t("org.action.submit")}
                              </button>
                            </form>
                          </>
                        )}
                        {e.status === "PUBLISHED" && (
                          <>
                            <Link
                              href={`/organizer/events/${e.id}/attendees`}
                              className="text-[13px] font-medium text-ink hover:underline"
                            >
                              {t("org.action.attendees")}
                            </Link>
                            <Link
                              href={`/organizer/events/${e.id}/check-in`}
                              className="text-[13px] font-semibold text-ink hover:underline"
                            >
                              {t("org.action.checkIn")}
                            </Link>
                            <form action={cancelEventAction} className="inline-flex">
                              <input type="hidden" name="eventId" value={e.id} />
                              <button
                                type="submit"
                                className="text-[13px] font-medium text-danger hover:underline"
                              >
                                {t("org.action.cancel")}
                              </button>
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
    </>
  );
}
