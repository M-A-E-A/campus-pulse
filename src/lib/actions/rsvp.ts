"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { EVENTS_TAG, CLUBS_TAG } from "@/lib/queries";
import { getT } from "@/i18n/server";
import { performRsvp, performCancelRsvp } from "@/lib/rsvp-core";
import { dispatchPushes } from "@/lib/push";

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

  // A seat handed to someone on the waitlist is the loudest thing that
  // happens in this app — push it. `after()` runs post-response, so the
  // canceller's button doesn't wait on the push service (and dispatch itself
  // never throws), while Next still guarantees the work outlives the request.
  const promoted = result.promotedUserId;
  if (promoted) after(() => dispatchPushes([promoted]));

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
  // Phase 12: the directory and the profile both print follow state and
  // follower counts from the tagged cache — refresh both, or the number
  // stays where it was until the 60s window rolls over.
  revalidateTag(CLUBS_TAG);
  revalidatePath("/clubs");
  revalidatePath(`/clubs/${clubId}`);
}
