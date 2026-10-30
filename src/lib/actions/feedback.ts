"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getT } from "@/i18n/server";

/** Post-event feedback result: the dictionary key already rendered. */
export type FeedbackResult = { ok: boolean; message: string };

/**
 * Record "would you attend again?" for an event that has ENDED, from the
 * signer's own ticket. Re-answering is allowed (the thank-you band offers
 * "change my answer"), so this upserts the two feedback columns on the
 * existing RSVP — feedback belongs to (user, event), which the RSVP already
 * is, uniquely. Guarded on all three axes the UI shows: session, event over,
 * own CONFIRMED ticket. The answer feeds the dashboard's recommendations.
 */
export async function feedbackAction(
  eventId: string,
  attendAgain: boolean
): Promise<FeedbackResult> {
  const [session, t] = await Promise.all([auth(), getT()]);
  if (!session?.user) return { ok: false, message: t("detail.post.loginFirst") };
  if (typeof attendAgain !== "boolean")
    return { ok: false, message: t("detail.rsvp.error") };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { endsAt: true },
  });
  if (!event) return { ok: false, message: t("detail.rsvp.notFound") };
  if (event.endsAt >= new Date())
    return { ok: false, message: t("detail.post.tooEarly") };

  const rsvp = await prisma.rsvp.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId } },
    select: { status: true },
  });
  if (!rsvp || rsvp.status !== "CONFIRMED")
    return { ok: false, message: t("detail.post.noTicket") };

  await prisma.rsvp.update({
    where: { userId_eventId: { userId: session.user.id, eventId } },
    data: { attendAgain, feedbackAt: new Date() },
  });

  // The band and the dashboard recommendations both read the answer.
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: t("detail.post.answered") };
}
