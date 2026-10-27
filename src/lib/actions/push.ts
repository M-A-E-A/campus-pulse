"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/i18n/core";

/**
 * Storing a browser's push subscription. Auth-gated: a subscription row is
 * just an address + encryption keys, and the only honest pairing is
 * "whoever is signed in on this browser" — nobody can attach their endpoint
 * to another account, and re-subscribing simply moves/upserts the row
 * (endpoint is unique, so one browser can never fan out as several rows).
 */

export type PushSubscribeResult = { ok: boolean; error?: string };

const MAX_ENDPOINT = 2_048; // push-service endpoints are URLs, never megabytes
const MAX_KEY = 512; // p256dh/auth are ~90-char base64url strings

export async function subscribePushAction(input: {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  locale?: string;
}): Promise<PushSubscribeResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  const endpoint = String(input.endpoint ?? "");
  const p256dh = String(input.p256dh ?? "");
  const authKey = String(input.auth ?? "");
  if (!endpoint.startsWith("https://") || endpoint.length > MAX_ENDPOINT) {
    return { ok: false, error: "invalid endpoint" };
  }
  if (!p256dh || !authKey || p256dh.length > MAX_KEY || authKey.length > MAX_KEY) {
    return { ok: false, error: "invalid keys" };
  }
  // The device's reading language, captured here because a future push has no
  // request context to read cp-locale from.
  const locale = isLocale(input.locale) ? input.locale : "fr";

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.user.id, endpoint, p256dh, auth: authKey, locale },
    // Re-subscribe from the same browser rebinds it to the current account
    // (shared machine / re-login) and refreshes the keys if they rotated.
    update: { userId: session.user.id, p256dh, auth: authKey, locale, lastSeenAt: new Date() },
  });
  return { ok: true };
}

export async function unsubscribePushAction(endpoint: string): Promise<PushSubscribeResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };
  // Scoped by userId: you can only detach your own devices, never someone's.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
  return { ok: true };
}
