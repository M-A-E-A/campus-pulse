"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { EVENTS_TAG } from "@/lib/queries";
import { categorySchema, clubSchema, rejectSchema } from "@/lib/validation";
import { getT, firstZodMessage } from "@/i18n/server";
import { notifyClubFollowers } from "@/lib/notifications-core";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session.user;
}

export async function approveEventAction(formData: FormData) {
  await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { clubId: true },
  });
  // updateMany guarded on PENDING is the idempotency check: count === 1 means
  // this approval actually flipped a row, so it's safe to fan out notices.
  const approved = await prisma.event.updateMany({
    where: { id: eventId, status: "PENDING" },
    data: { status: "PUBLISHED", rejectionReason: null },
  });
  if (approved.count === 1 && event) {
    await notifyClubFollowers(event.clubId, eventId);
  }
  revalidatePath("/admin");
  revalidatePath("/events");
  revalidateTag(EVENTS_TAG); // it's now live on the public lists
}

export type RejectState = { error?: string } | null;

export async function rejectEventAction(_prev: RejectState, formData: FormData): Promise<RejectState> {
  await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  const parsed = rejectSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { error: await firstZodMessage(parsed.error) };

  await prisma.event.updateMany({
    where: { id: eventId, status: "PENDING" },
    data: { status: "REJECTED", rejectionReason: parsed.data.reason },
  });
  revalidatePath("/admin");
  return null;
}

export async function createCategoryAction(_prev: RejectState, formData: FormData): Promise<RejectState> {
  await requireAdmin();
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: await firstZodMessage(parsed.error) };

  const t = await getT();
  const exists = await prisma.category.findUnique({ where: { name: parsed.data.name } });
  if (exists) return { error: t("admin.action.categoryExists") };

  await prisma.category.create({ data: { name: parsed.data.name } });
  revalidatePath("/admin/categories");
  revalidateTag(EVENTS_TAG); // the new name shows in the /events filter
  return null;
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const categoryId = String(formData.get("categoryId") ?? "");
  // FK protection: don't delete a category events still use.
  const inUse = await prisma.event.count({ where: { categoryId } });
  if (inUse > 0) return;
  await prisma.category.delete({ where: { id: categoryId } });
  revalidatePath("/admin/categories");
  revalidateTag(EVENTS_TAG);
}

export async function createClubAction(_prev: RejectState, formData: FormData): Promise<RejectState> {
  await requireAdmin();
  const parsed = clubSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: await firstZodMessage(parsed.error) };

  const t = await getT();
  const exists = await prisma.club.findUnique({ where: { name: parsed.data.name } });
  if (exists) return { error: t("admin.action.clubExists") };

  await prisma.club.create({ data: parsed.data });
  revalidatePath("/admin/clubs");
  return null;
}

/** Make a registered user an organizer of a club by adding a ClubMember row. */
export async function promoteOrganizerAction(_prev: RejectState, formData: FormData): Promise<RejectState> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const clubId = String(formData.get("clubId") ?? "");

  const t = await getT();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: t("admin.action.noUser") };

  await prisma.clubMember.upsert({
    where: { userId_clubId: { userId: user.id, clubId } },
    create: { userId: user.id, clubId },
    update: {},
  });
  await prisma.user.update({ where: { id: user.id }, data: { role: "ORGANIZER" } });
  revalidatePath("/admin/clubs");
  return null;
}
