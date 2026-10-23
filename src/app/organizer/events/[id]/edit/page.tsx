import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth, isClubOrganizer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toLocalInputValue } from "@/lib/tz";
import { EventForm } from "@/components/organizer/EventForm";
import { getT } from "@/i18n/server";

export default async function EditEventPage({
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

  // Server-side authorization: own club's event, or admin.
  const allowed = await isClubOrganizer(session.user.id, event.clubId);
  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="empty">
          <p>{t("org.edit.denied", { club: event.club.name })}</p>
          <p className="mt-1 text-sm">{t("org.edit.deniedHint")}</p>
          <Link href="/organizer" className="btn btn-secondary mt-4">{t("org.back")}</Link>
        </div>
      </div>
    );
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/organizer" className="text-sm text-muted hover:text-ink">{t("org.back")}</Link>
      <h1 className="mt-2 text-3xl font-bold">{t("org.edit.header")}</h1>
      <p className="mt-1 text-muted">{event.title} · {event.club.name}</p>
      <div className="mt-8">
        <EventForm
          mode="edit"
          clubId={event.clubId}
          eventId={event.id}
          categories={categories}
          event={{
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            startsAt: event.startsAt.toISOString(),
            endsAt: event.endsAt.toISOString(),
            capacity: event.capacity,
            categoryId: event.categoryId,
            coverImage: event.coverImage,
          }}
          localStart={toLocalInputValue(event.startsAt)}
          localEnd={toLocalInputValue(event.endsAt)}
        />
      </div>
    </div>
  );
}
