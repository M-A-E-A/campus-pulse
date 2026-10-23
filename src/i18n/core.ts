/**
 * Locale primitives shared by server and client.
 * Keep this module free of dictionary data — it is imported by client
 * components, and only `import type` from `./index` is allowed here
 * (type-only imports are erased, so the dictionary never lands in a chunk).
 */

export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_DIRS: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  fr: "ltr",
  ar: "rtl",
};

export type Vars = Record<string, string | number>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Replace `{name}` placeholders. Missing keys fall back to the key itself. */
export function translate(
  dict: Record<string, string>,
  key: string,
  vars?: Vars
): string {
  const raw = dict[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}
