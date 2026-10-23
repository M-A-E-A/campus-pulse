"use client";

import { useTransition } from "react";
import { setLocaleAction } from "@/lib/actions/locale";
import { useLocale, useT } from "@/i18n/provider";
import type { Locale } from "@/i18n/core";

const OPTIONS: { code: Locale; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
  { code: "ar", label: "AR" },
];

/**
 * FR / EN / AR pills. The action sets the cookie and revalidates the tree;
 * the reload guarantees <html lang/dir> and the Arabic font swap land even
 * if the router patches the document lazily.
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className="flex items-center rounded-md border border-line p-0.5"
    >
      {OPTIONS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          disabled={pending}
          aria-pressed={locale === code}
          onClick={() =>
            startTransition(async () => {
              await setLocaleAction(code);
              window.location.reload();
            })
          }
          className={`rounded px-2 py-1 text-xs font-semibold leading-none transition-colors ${
            locale === code
              ? "bg-ink text-paper"
              : "text-muted hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
