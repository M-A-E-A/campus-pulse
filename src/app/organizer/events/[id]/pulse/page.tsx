import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth, isClubOrganizer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getT } from "@/i18n/server";
import { PulseScreen } from "@/components/organizer/PulseScreen";

/** Projector door display for one event. Same gate as the attendees page. */
export default async function PulsePage({
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
    select: { id: true, title: true, clubId: true, capacity: true },
  });
  if (!event) notFound();

  const allowed =
    session.user.role === "ADMIN" ||
    (await isClubOrganizer(session.user.id, event.clubId));
  if (!allowed) redirect("/organizer");

  return (
    <div className="bg-ink">
      <Link
        href="/organizer"
        className="mx-auto block max-w-5xl px-4 pt-4 text-sm text-paper/60 hover:text-paper"
      >
        {t("org.back")}
      </Link>
      {/* the screen owns the viewport — start counts at 0, SSE fills in instantly */}
      <PulseScreen
        eventId={event.id}
        eventTitle={event.title}
        initial={{ total: 0, checkedIn: 0, capacity: event.capacity }}
      />
    </div>
  );
}
