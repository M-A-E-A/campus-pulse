import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { chooseRoleAction } from "@/lib/actions/auth";
import { getT } from "@/i18n/server";

/**
 * Post-login crossroads — shown on every sign-in except admins (who skip
 * it in loginAction). Two answers, two homes: the student card is a plain
 * link (any role may open the student dashboard), the organizer card is a
 * server action that promotes students on the spot and re-issues the
 * session so edge middleware lets them through /organizer.
 *
 * Composition follows the login page's poster language: headline on the
 * page's own grid (same left edge as the wordmark), then a pair of colour
 * fields — calm surface for the student path, ink for the organizer path.
 * Deliberately motion-free: this is a utility gate, not a browse surface.
 */
export default async function ChoosePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?from=/choose");
  // Admins never see this page; the guard covers a direct visit.
  if (session.user.role === "ADMIN") redirect("/admin");

  const t = await getT();

  return (
    // Root is a div: the layout already provides <main id="main"> — a
    // second <main> here would be invalid.
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-col">
      <header className="mx-auto w-full max-w-6xl px-4 pb-8 pt-12 sm:pt-16">
        <h1 className="display-chapter max-w-[16ch]">{t("auth.choose.title")}</h1>
        <p className="mt-4 max-w-[48ch] text-muted">{t("auth.choose.sub")}</p>
      </header>

      {/* Two equal rows on phones so the pair fills the first screen; one
          row of two columns from lg up. No rules anywhere: tone separates
          the ink field from the surface field, and both from the page. */}
      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
        <section className="flex flex-col justify-center gap-4 bg-surface px-4 py-12 sm:px-10">
          <h2 className="text-[27px] font-extrabold leading-tight tracking-tight md:text-[32px]">
            {t("auth.choose.student.title")}
          </h2>
          <p className="max-w-[38ch] text-muted">{t("auth.choose.student.blurb")}</p>
          <Link href="/dashboard" data-choose="student" className="btn btn-primary group self-start">
            <span className="underline-offset-4 group-hover:underline">
              {t("auth.choose.student.cta")}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 rtl:-scale-x-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14m0 0-6-6m6 6-6 6" />
            </svg>
          </Link>
        </section>

        <section className="field-ink flex flex-col justify-center gap-4 px-4 py-12 sm:px-10">
          <h2 className="text-[27px] font-extrabold leading-tight tracking-tight md:text-[32px]">
            {t("auth.choose.organizer.title")}
          </h2>
          <p className="max-w-[38ch] text-paper/70">{t("auth.choose.organizer.blurb")}</p>
          <form action={chooseRoleAction}>
            <button type="submit" data-choose="organizer" className="btn btn-primary group">
              <span className="underline-offset-4 group-hover:underline">
                {t("auth.choose.organizer.cta")}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 rtl:-scale-x-100"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14m0 0-6-6m6 6-6 6" />
              </svg>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
