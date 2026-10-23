"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { translate, type Locale } from "./core";
import type { FullDict, T } from "./index";

type I18nValue = { locale: Locale; dir: "ltr" | "rtl"; dict: FullDict };

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Mounted once in the root layout, wrapping <body>. Server components read
 * the dictionary directly via `getT()`; client components call `useT()`.
 * The active dictionary arrives as an RSC prop, so only one language is
 * ever serialized into the page.
 */
export function I18nProvider({
  locale,
  dir,
  dict,
  children,
}: I18nValue & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, dir, dict }), [locale, dir, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): T {
  const ctx = useContext(I18nContext);
  return useMemo<T>(
    () => (key, vars) => (ctx ? translate(ctx.dict, key, vars) : key),
    [ctx]
  );
}

export function useLocale(): Locale {
  return useContext(I18nContext)?.locale ?? "en";
}
