"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { EVENTS_TAG } from "@/lib/queries";
import { eventSchema } from "@/lib/validation";
import { fromLocalInputValue } from "@/lib/tz";
import { uploadImage } from "@/lib/storage";
import { getT, firstZodMessage } from "@/i18n/server";

export type EventFormState = { error?: string; values?: Record<string, string> } | null;

async function requireOrganizerOf(clubId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  const membership = await prisma.clubMember.findUnique({
    where: { userId_clubId: { userId: session.user.id, clubId } },
  });
  // Server-side check: belongs to the club, or is an admin.
  if (!membership && session.user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session.user;
}

function parseEventForm(formData: FormData) {
  const raw = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    location: String(formData.get("location") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    capacity: String(formData.get("capacity") ?? "") || undefined,
    categoryId: String(formData.get("categoryId") ?? ""),
  };
  return eventSchema.safeParse(raw);
}

export async function createEventAction(
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const t = await getT();
  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return {
      error: await firstZodMessage(parsed.error),
      values: Object.fromEntries(
        ["title", "description", "location", "startsAt", "endsAt", "capacity"].map((k) => [
          k,
          String(formData.get(k) ?? ""),
        ])
      ),
    };
  }

  const clubId = String(formData.get("clubId") ?? "");
  try {
    await requireOrganizerOf(clubId);
  } catch {
    return { error: t("org.action.ownClubOnly") };
  }

  const image = formData.get("coverImage") as File | null;
  const coverImage = image && image.size > 0 ? await uploadImage(image, "events") : undefined;

  const { capacity, startsAt, endsAt, ...rest } = parsed.data;
  await prisma.event.create({
    data: {
      ...rest,
      clubId,
      coverImage,
      capacity: capacity ? Number(capacity) : null,
      startsAt: fromLocalInputValue(startsAt),
      endsAt: fromLocalInputValue(endsAt),
      status: "DRAFT",
    },
  });

  revalidatePath("/organizer");
  redirect("/organizer");
}

export async function updateEventAction(
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const t = await getT();
  const parsed = parseEventForm(formData);
  if (!parsed.success) {
    return { error: await firstZodMessage(parsed.error) };
  }

  const eventId = String(formData.get("eventId") ?? "");
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) return { error: t("org.action.notFound") };

  try {
    await requireOrganizerOf(existing.clubId);
  } catch {
    return { error: t("org.action.editOwnOnly") };
  }

  if (existing.status === "PUBLISHED") {
    return {
      error: t("org.action.publishedLocked"),
    };
  }

  const image = formData.get("coverImage") as File | null;
  const coverImage =
    image && image.size > 0 ? await uploadImage(image, "events") : existing.coverImage;

  const { capacity, startsAt, endsAt, ...rest } = parsed.data;
  await prisma.event.update({
    where: { id: eventId },
    data: {
      ...rest,
      coverImage,
      capacity: capacity ? Number(capacity) : null,
      startsAt: fromLocalInputValue(startsAt),
      endsAt: fromLocalInputValue(endsAt),
    },
  });

  revalidatePath("/organizer");
  redirect("/organizer");
}

/** Draft/rejected → pending, so an admin can review it. */
export async function submitEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) return;

  try {
    await requireOrganizerOf(existing.clubId);
  } catch {
    return;
  }

  if (existing.status !== "DRAFT" && existing.status !== "REJECTED") return;

  await prisma.event.update({
    where: { id: eventId },
    data: { status: "PENDING", rejectionReason: null },
  });
  revalidatePath("/organizer");
}

export async function cancelEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing) return;

  try {
    await requireOrganizerOf(existing.clubId);
  } catch {
    return;
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/organizer");
  revalidateTag(EVENTS_TAG); // cancelled events leave the public lists
}
