"use server";

import { auth } from "@/lib/auth";
import { rotateCalendarToken } from "@/lib/calendar-token";

/**
 * Invalidate the student's current feed link and issue a new one.
 * Used by the dashboard's calendar card when a link might have leaked.
 */
export async function regenerateCalendarAction(): Promise<
  { ok: true; token: string } | { ok: false }
> {
  const session = await auth();
  if (!session?.user) return { ok: false };

  const token = await rotateCalendarToken(session.user.id);
  return { ok: true, token };
}
