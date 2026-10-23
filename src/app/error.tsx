"use client";

import { useT } from "@/i18n/provider";

/** Root error boundary: branded fallback with a retry. */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <p className="font-display text-6xl font-bold text-accent" aria-hidden>
        !
      </p>
      <h1 className="mt-4 text-3xl font-bold">{t("errors.broke.title")}</h1>
      <p className="mt-2 text-muted">
        {t("errors.broke.body")}
      </p>
      <button onClick={reset} className="btn btn-primary mt-8">
        {t("errors.broke.retry")}
      </button>
    </div>
  );
}
