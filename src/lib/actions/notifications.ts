"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Mark MY notifications read. Every WHERE clause includes the session user, so
 * a crafted id can never touch someone else's row — the scope is enforced in
 * the query, not just in the UI.
 *
 * revalidatePath("/", "layout") because the bell lives in the root layout's
 * Nav: one invalidation refreshes it wherever the reader happens to be.
 */
export async function markNotificationReadAction(id: string) {
  const session = await auth();
  if (!session?.user) return;

  await prisma.notification.updateMany({
    where: { id, userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
