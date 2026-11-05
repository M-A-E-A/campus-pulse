"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { loginLimiter, LOGIN_LIMIT } from "@/lib/rate-limit";
import {
  CREATOR_COOKIE,
  creatorConfigured,
  secretEquals,
  signCreatorSession,
} from "@/lib/creator-session";

export type CreatorFormState = { error?: string } | null;

/** `from` is caller-controlled, so it is only ever honoured as an in-app
 *  path — the same rule as the app login's `safeFrom`. */
function safeFrom(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/creator";
}

/**
 * The creator's special login: two env credentials, no user row, no
 * NextAuth session. Both halves must match (compared as SHA-256 digests,
 * constant-time) and the attempt is rate-limited per submitted login —
 * keyed by the login rather than the IP for the same NAT reasoning as the
 * app login: hundreds of students share one campus egress.
 */
export async function creatorLoginAction(
  _prev: CreatorFormState,
  formData: FormData,
): Promise<CreatorFormState> {
  const t = await getT();
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!creatorConfigured()) return { error: t("creator.login.notConfigured") };

  const key = `creator:${login.toLowerCase()}`;
  if (loginLimiter.exceeded(key, LOGIN_LIMIT.limit)) {
    return { error: t("creator.login.tooMany") };
  }

  const [loginOk, passwordOk] = await Promise.all([
    secretEquals(login, process.env.CREATOR_LOGIN ?? ""),
    secretEquals(password, process.env.CREATOR_PASSWORD ?? ""),
  ]);
  if (!loginOk || !passwordOk) {
    loginLimiter.record(key, LOGIN_LIMIT.limit, LOGIN_LIMIT.windowMs);
    return { error: t("creator.login.invalid") };
  }
  loginLimiter.clear(key);

  const token = await signCreatorSession();
  if (!token) return { error: t("creator.login.notConfigured") };

  const store = await cookies();
  store.set(CREATOR_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // The app is served over plain HTTP on this origin (its own session
    // cookies are non-secure here too); flip to true when the deployment
    // is HTTPS-only.
    secure: false,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  redirect(safeFrom(formData.get("from")));
}

export async function creatorLogoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(CREATOR_COOKIE);
  redirect("/creator/login");
}
