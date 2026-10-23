import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Secret tokens for the personal ICS subscription feed
 * (/api/calendar/[token]). The token IS the credential — standard pattern
 * for calendar subscription URLs. Stored on the user, revocable by
 * rotating it (old links die immediately).
 */

/** 32 chars of base64url — 192 bits. */
function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Fetch-or-create the user's feed token. */
export async function ensureCalendarToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarToken: true },
  });
  if (user?.calendarToken) return user.calendarToken;

  const token = newToken();
  // Unique collision is astronomically unlikely; the retry covers it anyway.
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { calendarToken: token },
    });
  } catch {
    const fresh = newToken();
    await prisma.user.update({
      where: { id: userId },
      data: { calendarToken: fresh },
    });
    return fresh;
  }
  return token;
}

/** Invalidate the old link and issue a new one. */
export async function rotateCalendarToken(userId: string): Promise<string> {
  const token = newToken();
  await prisma.user.update({
    where: { id: userId },
    data: { calendarToken: token },
  });
  return token;
}
