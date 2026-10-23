import Link from "next/link";
import { getT } from "@/i18n/server";

/** 404 — for wrong URLs and for events that no longer exist. */
export default async function NotFound() {
  const t = await getT();
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <p className="font-display text-7xl font-bold text-accent" aria-hidden>
        404
      </p>
      <h1 className="mt-4 text-3xl font-bold">{t("errors.notFound.title")}</h1>
      <p className="mt-2 text-muted">
        {t("errors.notFound.body")}
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/events" className="btn btn-primary">
          {t("errors.notFound.browse")}
        </Link>
        <Link href="/" className="btn btn-secondary">
          {t("errors.notFound.home")}
        </Link>
      </div>
    </div>
  );
}
