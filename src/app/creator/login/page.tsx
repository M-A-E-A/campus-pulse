import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CREATOR_COOKIE, creatorConfigured, verifyCreatorSession } from "@/lib/creator-session";
import { getT } from "@/i18n/server";
import { CreatorLoginForm } from "./LoginForm";

export const metadata = {
  // A private console's login door should not be indexed or followed.
  robots: { index: false, follow: false },
};

/**
 * The creator's own sign-in — deliberately separate from the app's login:
 * env credentials, a signed `cp-creator` cookie, no user row. An already
 * valid cookie skips the door entirely, and a visitor without the env
 * vars gets an honest "not configured" notice instead of a form that can
 * only ever fail.
 */
export default async function CreatorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const t = await getT();

  const store = await cookies();
  if (await verifyCreatorSession(store.get(CREATOR_COOKIE)?.value)) {
    redirect("/creator");
  }

  const configured = creatorConfigured();

  return (
    <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-6xl items-center px-4 py-14">
      <div className="w-full max-w-sm">
        <h1 className="text-[27px] font-extrabold leading-tight tracking-tight md:text-[32px]">
          {t("creator.login.title")}
        </h1>
        <p className="mt-2 text-muted">{t("creator.login.lead")}</p>

        {configured ? (
          <CreatorLoginForm from={from} />
        ) : (
          <div className="empty mt-8" role="status">
            <p>{t("creator.login.notConfigured")}</p>
          </div>
        )}

        <p className="mt-6 text-sm text-muted">
          <Link href="/" className="font-semibold text-accent-dark">
            {t("creator.login.back")}
          </Link>
        </p>
      </div>
    </div>
  );
}
