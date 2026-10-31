"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginLimiter, loginKey, LOGIN_LIMIT } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { registerSchema } from "@/lib/validation";
import { getT, firstZodMessage } from "@/i18n/server";

export type FormState = { error?: string } | null;

/**
 * Where a role lands after signing in. This only decides when there is no
 * `from` — the middleware already sets `from` whenever it bounces someone off
 * a protected page, and that return trip still wins (a student who tapped Save
 * on an event has to come back to that event). Without this, every direct
 * sign-in landed on the student dashboard, so organizers and admins were
 * dropped on a page they cannot use.
 */
function homePathFor(role: string | undefined): string {
  if (role === "ADMIN") return "/admin";
  if (role === "ORGANIZER") return "/organizer";
  return "/dashboard";
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
    // Everyone registers as a student, so this is the student landing.
    redirectTo: homePathFor("STUDENT"),
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
      redirectTo: safeFrom(formData.get("from")) ?? homePathFor(user?.role),
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
