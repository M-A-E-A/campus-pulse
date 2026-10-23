import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EventForm } from "@/components/organizer/EventForm";
import { getT } from "@/i18n/server";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ clubId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const t = await getT();

  const { clubId } = await searchParams;

  // Which clubs can this user create events for?
  const memberships = await prisma.clubMember.findMany({
    where: { userId: session.user.id },
    include: { club: { select: { id: true, name: true } } },
  });
  const allowed = memberships.map((m) => m.club);

  if (allowed.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="empty">
          <p>{t("org.new.noClub")}</p>
          <p className="mt-1 text-sm">{t("org.new.noClubHint")}</p>
          <Link href="/" className="btn btn-secondary mt-4">{t("org.new.backHome")}</Link>
        </div>
      </div>
    );
  }

  // Only accept a clubId the user is actually a member of.
  const targetClub = allowed.find((c) => c.id === clubId) ?? allowed[0];
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/organizer" className="text-sm text-muted hover:text-ink">{t("org.back")}</Link>
      <h1 className="mt-2 text-3xl font-bold">{t("org.new.header")}</h1>
      <p className="mt-1 text-muted">
        {t("org.new.for1")}<span className="font-semibold text-ink">{targetClub.name}</span>{t("org.new.for2")}
      </p>
      <div className="mt-8">
        <EventForm mode="create" clubId={targetClub.id} categories={categories} />
      </div>
    </div>
  );
}
