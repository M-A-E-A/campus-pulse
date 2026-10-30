"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/provider";
import { registerAction, type FormState } from "@/lib/actions/auth";
import { isOfflineError } from "@/lib/offline";

export function RegisterForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    // Same offline guard as /login — no network is a state, not a crash.
    async (prev, formData) => {
      try {
        return await registerAction(prev, formData);
      } catch (err) {
        if (isOfflineError(err)) return { error: t("errors.offline") };
        throw err;
      }
    },
    null
  );

  return (
    <div className="relative">
      {/* Same split as /login so the two auth screens read as one pair. */}
      <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-6xl items-center px-4 py-14">
        <div className="w-full max-w-sm">
          <h1 className="text-[27px] font-extrabold leading-tight tracking-tight md:text-[32px]">
            {t("auth.register.title")}
          </h1>
          <p className="mt-2 text-muted">{t("auth.register.sub")}</p>

          <form action={formAction} className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="name">{t("auth.name")}</label>
              <input className="input" id="name" name="name" required autoComplete="name" />
            </div>
            <div>
              <label className="label" htmlFor="email">{t("auth.email")}</label>
              <input className="input" id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">{t("auth.password")}</label>
              <input className="input" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
              {/* 13px, not the 12px default — the floor everywhere else in the app. */}
              <p className="mt-1 text-[13px] text-muted">{t("auth.passwordHint")}</p>
            </div>
            {state?.error && (
              <p className="text-sm text-danger" role="alert">{state.error}</p>
            )}
            <button className="btn btn-primary w-full" disabled={pending}>
              {pending ? t("auth.register.pending") : t("auth.register.submit")}
            </button>
          </form>

          <p className="mt-6 text-sm text-muted">
            {t("auth.register.hasAccount")}{" "}
            <Link href="/login" className="font-semibold text-accent-dark">{t("nav.login")}</Link>
          </p>
        </div>
      </div>

      {/* Copy already approved on the landing — no new words introduced.
          Same centre anchoring as /login so the pair stays a pair. */}
      <aside className="absolute inset-y-0 end-0 hidden w-[42%] flex-col justify-center bg-ink px-10 py-12 text-paper lg:flex">
        <span aria-hidden="true" className="absolute start-10 top-12 block h-1.5 w-16 bg-accent" />
        <div>
          <p className="font-display text-[clamp(2rem,3vw,3.25rem)] font-extrabold leading-[1.1]">
            <span className="block">{t("landing.hero.title1")}</span>
            <span className="block text-accent">{t("landing.hero.title2")}</span>
          </p>
          <p className="mt-6 max-w-[26ch] text-sm leading-relaxed text-paper/70">
            {t("landing.footer.tagline")}
          </p>
        </div>
      </aside>
    </div>
  );
}
