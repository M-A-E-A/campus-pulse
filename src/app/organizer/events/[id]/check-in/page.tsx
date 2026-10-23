import { notFound, redirect } from "next/navigation";
import { auth, isClubOrganizer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckInScanner } from "@/components/organizer/CheckInScanner";

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, title: true, clubId: true },
  });
  if (!event) notFound();

  const allowed = await isClubOrganizer(session.user.id, event.clubId);
  if (!allowed) redirect("/organizer");

  return <CheckInScanner eventId={event.id} eventTitle={event.title} />;
}
