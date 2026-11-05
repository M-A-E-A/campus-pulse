"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn, signOut, unstable_update } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginLimiter, loginKey, LOGIN_LIMIT } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { registerSchema } from "@/lib/validation";
import { getT, firstZodMessage } from "@/i18n/server";

export type FormState = { error?: string } | null;

/**
 * Where a sign-in lands when there is no `from` return trip. Admins go
 * straight to their console; everyone else answers "student or
 * event organizer?" on /choose first — that page picks the home they need
 * and, from the organizer card, grants the role. The middleware already
 * sets `from` whenever it bounces someone off a protected page, and that
 * return trip still wins (a student who tapped Save on an event has to
 * come back to that event).
 */
function postLoginPath(role: string | undefined): string {
  return role === "ADMIN" ? "/admin" : "/choose";
}

/** `from` is caller-controlled, so it is only ever honoured as an in-app path.
 *  `//evil.com` and absolute URLs are discarded instead of redirected to. */
function safeFrom(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : undefined;
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: await firstZodMessage(parsed.error) };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    const t = await getT();
    return { error: t("auth.error.emailTaken") };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      // Everyone registers as a student. Admins promote organizers.
      role: "STUDENT",
    },
  });

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    // Everyone registers as a student — the choice page asks who they are
    // before landing them (admins do not exist yet at this point).
    redirectTo: "/choose",
  });
  return null;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const email = String(formData.get("email") ?? "");
    const key = loginKey(email);
    // Pre-check: past the limit, don't even attempt — the honest message,
    // no extra bcrypt work, and (via authorize) the raw callback path is
    // denied the same way without it.
    if (loginLimiter.exceeded(key, LOGIN_LIMIT.limit)) {
      const lockedT = await getT();
      return { error: lockedT("auth.error.tooManyAttempts") };
    }
    // The role has to be read *before* signing in: `signIn` ends in a redirect,
    // so nothing after it runs. It is only acted on once the password checks
    // out — a wrong one throws first — so it tells an attacker nothing about
    // whether the account exists.
    const user = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });

    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo: safeFrom(formData.get("from")) ?? postLoginPath(user?.role),
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      // Every failed sign-in counts toward the lockout. `justLocked` fires
      // once per window — one audit row per lockout, not one per spam hit.
      const email = String(formData.get("email") ?? "");
      const { justLocked } = loginLimiter.record(
        loginKey(email),
        LOGIN_LIMIT.limit,
        LOGIN_LIMIT.windowMs
      );
      if (justLocked) {
        await recordAudit({
          actorId: null,
          actorName: email.trim().toLowerCase(), // normalized snapshot
          action: "auth.rate_limited",
          targetType: "auth",
          targetId: email,
          meta: { limit: LOGIN_LIMIT.limit, windowMinutes: LOGIN_LIMIT.windowMs / 60_000 },
        });
      }
      const t = await getT();
      return { error: t("auth.error.invalidCredentials") };
    }
    throw error; // NEXT_REDIRECT must propagate
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

/**
 * The /choose organizer card. A student is promoted to ORGANIZER here —
 * self-serve, because real event power still needs an admin-curated
 * ClubMember row (this only opens the console, whose no-club state already
 * says "Ask an admin to add you"). The fresh role is then written into the
 * session cookie: edge middleware reads only the JWT, so without the
 * `unstable_update` refresh it would bounce the caller it was just granted
 * access to. Existing organizers only redirect; admins never see the page.
 */
export async function chooseRoleAction(): Promise<never> {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login?from=/choose");
  if (user.role === "ADMIN") redirect("/admin");

  if (user.role === "STUDENT") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "ORGANIZER" } });
    await recordAudit({
      actorId: user.id,
      actorName: user.name ?? user.email ?? "unknown",
      action: "user.self_promoted_organizer",
      targetType: "user",
      targetId: user.id,
      targetLabel: user.email ?? user.id,
      meta: { via: "choose" },
    });
    // Re-signs the JWT with the new role and sets the cookie on this
    // response, so the redirect below passes middleware as an organizer.
    await unstable_update({ user: { role: "ORGANIZER" } });
  }
  redirect("/organizer");
}
