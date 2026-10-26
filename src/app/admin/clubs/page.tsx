import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getT } from "@/i18n/server";
import { AdminHeader } from "../AdminHeader";
import { ClubForms } from "./ClubForms";

export default async function AdminClubsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  const t = await getT();

  const clubs = await prisma.club.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { events: true, members: true } },
      members: { include: { user: { select: { name: true, email: true } } } },
    },
  });

  return (
    <>
      <AdminHeader titleKey="admin.clubs.header" active="/admin/clubs" />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <ClubForms clubs={clubs.map((c) => ({ id: c.id, name: c.name }))} />

        <ul className="mt-8 space-y-4">
          {clubs.map((c) => (
            <li key={c.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold">{c.name}</p>
                  <p className="text-sm text-muted">{c.description}</p>
                </div>
                <span className="text-sm text-muted">
                  {t("admin.clubs.count", { events: c._count.events, members: c._count.members })}
                </span>
              </div>
              {c.members.length > 0 && (
                <p className="mt-2 text-sm">
                  {t("admin.clubs.organizers")}{" "}
                  {c.members.map((m) => `${m.user.name} (${m.user.email})`).join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
