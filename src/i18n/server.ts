import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { translate, isLocale, LOCALE_DIRS, type Locale } from "./core";
import { en, fr, ar, type DictKey, type FullDict, type T } from "./index";

const dictionaries: Record<Locale, FullDict> = { en, fr, ar };

export { LOCALE_DIRS };
export type { Locale };

/**
 * Locale for this request:
 *   1. `cp-locale` cookie (set by the switcher)
 *   2. first tag of Accept-Language, but only fr/ar — `en` stays the
 *      fallback so plain HTTP clients (smoke tests) always get English
 *   3. `en`
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const stored = (await cookies()).get("cp-locale")?.value;
  if (isLocale(stored)) return stored;

  const accept = (await headers()).get("accept-language") ?? "";
  const primary = accept.split(",")[0]?.split(";")[0]?.trim().toLowerCase() ?? "";
  const lang = primary.split("-")[0];
  if (lang === "fr" || lang === "ar") return lang;

  return "en";
});

export const getDict = cache(async (): Promise<FullDict> => {
  return dictionaries[await getLocale()];
});

/** `const t = await getT(); t("nav.events")` in server components/actions. */
export const getT = cache(async (): Promise<T> => {
  const dict = await getDict();
  return (key, vars) => translate(dict, key, vars);
});

/**
 * First Zod issue as a user-facing sentence in the active locale.
 * Issues raised by src/lib/validation.ts carry `common.valid.*` keys as
 * their message; anything else falls through translate() untouched (English).
 *
 *   if (!parsed.success) return { error: await firstZodMessage(parsed.error) };
 */
export async function firstZodMessage(error: {
  issues: readonly { message: string }[];
}): Promise<string> {
  const t = await getT();
  const issue = error.issues[0];
  if (!issue) return "";
  return t(issue.message as DictKey);
}
