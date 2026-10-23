import { auth, isClubOrganizer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csvCell(value: string): string {
  // Escape quotes and wrap — CSV injection 101.
  return `"${value.replace(/"/g, '""')}"`;
}

/** Attendee list as CSV. Same club-only authorization as the page. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { clubId: true, title: true },
  });
  if (!event) return new Response("Not found", { status: 404 });

  const allowed = await isClubOrganizer(session.user.id, event.clubId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const rsvps = await prisma.rsvp.findMany({
    where: { eventId: id, status: "CONFIRMED" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const header = ["Name", "Email", "RSVP date (UTC)", "Checked in (UTC)"];
  const rows = rsvps.map((r) => [
    r.user.name,
    r.user.email,
    r.createdAt.toISOString(),
    r.checkedInAt?.toISOString() ?? "",
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendees-${id}.csv"`,
    },
  });
}
