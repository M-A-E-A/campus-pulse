"use client";

import { useState } from "react";
import { regenerateCalendarAction } from "@/lib/actions/calendar";
import { useT } from "@/i18n/provider";

/**
 * "Add everything to my calendar" card on the student dashboard.
 * The feed URL is a secret (token = credential), so we show it truncated
 * with copy / open buttons rather than screaming it at shoulder-surfers,
 * and offer rotation when the link might have leaked.
 * The URL is built server-side (Host header) so it's in the SSR HTML.
 */
export function CalendarSubscribe({ token, origin }: { token: string; origin: string }) {
  const t = useT();
  const [currentToken, setCurrentToken] = useState(token);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const url = `${origin}/api/calendar/${currentToken}`;
  const webcalUrl = url.replace(/^http/, "webcal");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (http:// or permissions) — the input below is selectable.
    }
  }

  async function regenerate() {
    setBusy(true);
    const result = await regenerateCalendarAction();
    if (result.ok) {
      setCurrentToken(result.token);
      setCopied(false);
    }
    setBusy(false);
  }

  return (
    <section className="card mt-10 p-5">
      <h2 className="text-lg font-semibold">{t("cal.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("cal.desc")}</p>

      {/* Secret URL: selectable, but not broadcast in full. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label={t("cal.title")}
          className="input min-w-0 flex-1 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" className="btn btn-secondary shrink-0" onClick={copy}>
          {copied ? t("cal.copied") : t("cal.copy")}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <a href={webcalUrl} className="font-semibold text-accent-dark hover:underline">
          {t("cal.webcal")}
        </a>
        <a
          href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t("cal.googlePrefix"))}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-accent-dark hover:underline"
        >
          {t("cal.google")}
        </a>
        <button
          type="button"
          className="ms-auto text-muted hover:text-ink disabled:opacity-50"
          onClick={regenerate}
          disabled={busy}
          title={t("cal.rotateWarning")}
        >
          {busy ? t("cal.rotating") : t("cal.rotate")}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">{t("cal.rotateWarning")}</p>
    </section>
  );
}
