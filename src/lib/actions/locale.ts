"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/i18n/core";

/** Persist the chosen language and re-render the whole tree. */
export async function setLocaleAction(locale: unknown): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set("cp-locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
