import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/tz";
import { getT, getLocale } from "@/i18n/server";
import { AdminHeader } from "../AdminHeader";
import type { DictKey } from "@/i18n";

/**
 * The audit trail, newest first (src/lib/audit.ts writes the FACT; this
 * page translates it at read time — stored English never reaches a
 * reader). An action this dict hasn't caught up with falls back to the
 * raw string in muted mono instead of pretending it didn't happen —
 * hiding an unknown action would be the dishonest option.
 */
const KNOWN_ACTIONS = new Set<string>([
  "rsvp.created",
  "rsvp.cancelled",
  "rsvp.checked_in",
  "event.created",
  "event.updated",
  "event.submitted",
  "event.cancelled",
  "event.published",
  "event.rejected",
  "category.created",
  "category.deleted",
  "club.created",
  "user.promoted_organizer",
  "auth.rate_limited",
]);

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  const t = await getT();
  const locale = await getLocale();

  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const what = (action: string) =>
    KNOWN_ACTIONS.has(action) ? (
      t(`admin.audit.action.${action}` as DictKey)
    ) : (
      <span className="font-mono text-xs text-muted">{action}</span>
    );

  return (
    <>
      <AdminHeader titleKey="admin.audit.header" active="/admin/audit" />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-muted">{t("admin.audit.lead")}</p>

        {rows.length === 0 ? (
          <div className="empty mt-4">
            <p>{t("admin.audit.empty")}</p>
          </div>
        ) : (
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-line/25">
                  <th className="th">{t("admin.audit.th.when")}</th>
                  <th className="th">{t("admin.audit.th.who")}</th>
                  <th className="th">{t("admin.audit.th.what")}</th>
                  <th className="th">{t("admin.audit.th.target")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-auditrow data-audit-action={row.action}>
                    <td className="td whitespace-nowrap text-muted">
                      {formatDateTime(row.createdAt, locale)}
                    </td>
                    {/* The stored snapshot, not the live relation: the row
                        must still name who did it after that account is gone. */}
                    <td className="td font-medium">{row.actorName}</td>
                    <td className="td">{what(row.action)}</td>
                    <td className="td text-muted">
                      {row.targetLabel ?? row.targetId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
