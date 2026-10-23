"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { EVENTS_TAG } from "@/lib/queries";
import { getT } from "@/i18n/server";
import { performRsvp, performCancelRsvp } from "@/lib/rsvp-core";

/** What the client sees: the dictionary key already rendered to a sentence. */
export type RsvpResult = { ok: boolean; message: string };

/** RSVP to an event (requires login; capacity logic in rsvp-core.ts). */
export async function rsvpAction(eventId: string): Promise<RsvpResult> {
  const [session, t] = await Promise.all([auth(), getT()]);
  if (!session?.user) {
    return { ok: false, message: t("detail.rsvp.loginAction") };
  }

  const result = await performRsvp(session.user.id, eventId);

  if (result.ok) {
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/dashboard");
    // Public counts changed — refresh the cached catalogue.
    revalidateTag(EVENTS_TAG);
  }
  return { ok: result.ok, message: t(result.messageKey) };
}

export async function cancelRsvpAction(eventId: string): Promise<RsvpResult> {
  const [session, t] = await Promise.all([auth(), getT()]);
  if (!session?.user) return { ok: false, message: t("detail.rsvp.loginFirst") };

  const result = await performCancelRsvp(session.user.id, eventId);
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  revalidateTag(EVENTS_TAG); // the spot returns to the pool
  return { ok: result.ok, message: t(result.messageKey) };
}

export async function toggleSaveAction(eventId: string) {
  const session = await auth();
  if (!session?.user) return;

  const existing = await prisma.savedEvent.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId } },
  });
  if (existing) {
    await prisma.savedEvent.delete({ where: { id: existing.id } });
  } else {
    await prisma.savedEvent.create({
      data: { userId: session.user.id, eventId },
    });
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
}

export async function toggleFollowAction(clubId: string) {
  const session = await auth();
  if (!session?.user) return;

  const existing = await prisma.follow.findUnique({
    where: { userId_clubId: { userId: session.user.id, clubId } },
  });
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    await prisma.follow.create({
      data: { userId: session.user.id, clubId },
    });
  }
  revalidatePath("/dashboard");
}
