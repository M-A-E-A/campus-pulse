"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { EVENTS_TAG } from "@/lib/queries";
import { categorySchema, clubSchema, rejectSchema } from "@/lib/validation";
import { getT, firstZodMessage } from "@/i18n/server";
import { notifyClubFollowers } from "@/lib/notifications-core";
import { dispatchPushes } from "@/lib/push";
import { recordAudit } from "@/lib/audit";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session.user;
}

export async function approveEventAction(formData: FormData) {
  const actor = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { clubId: true, title: true },
  });
  // updateMany guarded on PENDING is the idempotency check: count === 1 means
  // this approval actually flipped a row, so it's safe to fan out notices.
  const approved = await prisma.event.updateMany({
    where: { id: eventId, status: "PENDING" },
    data: { status: "PUBLISHED", rejectionReason: null },
  });
  if (approved.count === 1 && event) {
    await recordAudit({
      actorId: actor.id,
      actorName: actor.name ?? actor.email ?? "unknown",
      action: "event.published",
      targetType: "event",
      targetId: eventId,
      targetLabel: event.title,
    });
    const { userIds } = await notifyClubFollowers(event.clubId, eventId);
    // Followers opted in for exactly this; it ships to the bell now and to
    // subscribed devices right after the response goes out.
    after(() => dispatchPushes(userIds));
  }
  revalidatePath("/admin");
  revalidatePath("/events");
  revalidateTag(EVENTS_TAG); // it's now live on the public lists
}

export type RejectState = { error?: string } | null;

export async function rejectEventAction(_prev: RejectState, formData: FormData): Promise<RejectState> {
  const actor = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  const parsed = rejectSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { error: await firstZodMessage(parsed.error) };

  const rejected = await prisma.event.updateMany({
    where: { id: eventId, status: "PENDING" },
    data: { status: "REJECTED", rejectionReason: parsed.data.reason },
  });
  if (rejected.count === 1) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { title: true } });
    await recordAudit({
      actorId: actor.id,
      actorName: actor.name ?? actor.email ?? "unknown",
      action: "event.rejected",
      targetType: "event",
      targetId: eventId,
      targetLabel: event?.title,
      meta: { reason: parsed.data.reason },
    });
  }
  revalidatePath("/admin");
  return null;
}

export async function createCategoryAction(_prev: RejectState, formData: FormData): Promise<RejectState> {
  const actor = await requireAdmin();
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: await firstZodMessage(parsed.error) };

  const t = await getT();
  const exists = await prisma.category.findUnique({ where: { name: parsed.data.name } });
  if (exists) return { error: t("admin.action.categoryExists") };

  const category = await prisma.category.create({ data: { name: parsed.data.name } });
  await recordAudit({
    actorId: actor.id,
    actorName: actor.name ?? actor.email ?? "unknown",
    action: "category.created",
    targetType: "category",
    targetId: category.id,
    targetLabel: category.name,
  });
  revalidatePath("/admin/categories");
  revalidateTag(EVENTS_TAG); // the new name shows in the /events filter
  return null;
}

export async function deleteCategoryAction(formData: FormData) {
  const actor = await requireAdmin();
  const categoryId = String(formData.get("categoryId") ?? "");
  // FK protection: don't delete a category events still use.
  const inUse = await prisma.event.count({ where: { categoryId } });
  if (inUse > 0) return;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  await prisma.category.delete({ where: { id: categoryId } });
  if (category) {
    await recordAudit({
      actorId: actor.id,
      actorName: actor.name ?? actor.email ?? "unknown",
      action: "category.deleted",
      targetType: "category",
      targetId: categoryId,
      targetLabel: category.name,
    });
  }
  revalidatePath("/admin/categories");
  revalidateTag(EVENTS_TAG);
}

export async function createClubAction(_prev: RejectState, formData: FormData): Promise<RejectState> {
  const actor = await requireAdmin();
  const parsed = clubSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: await firstZodMessage(parsed.error) };

  const t = await getT();
  const exists = await prisma.club.findUnique({ where: { name: parsed.data.name } });
  if (exists) return { error: t("admin.action.clubExists") };

  const club = await prisma.club.create({ data: parsed.data });
  await recordAudit({
    actorId: actor.id,
    actorName: actor.name ?? actor.email ?? "unknown",
    action: "club.created",
    targetType: "club",
    targetId: club.id,
    targetLabel: club.name,
  });
  revalidatePath("/admin/clubs");
  return null;
}

/** Make a registered user an organizer of a club by adding a ClubMember row. */
export async function promoteOrganizerAction(_prev: RejectState, formData: FormData): Promise<RejectState> {
  const actor = await requireAdmin();
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
  await recordAudit({
    actorId: actor.id,
    actorName: actor.name ?? actor.email ?? "unknown",
    action: "user.promoted_organizer",
    targetType: "user",
    targetId: user.id,
    targetLabel: user.email,
    meta: { clubId },
  });
  revalidatePath("/admin/clubs");
  return null;
}
