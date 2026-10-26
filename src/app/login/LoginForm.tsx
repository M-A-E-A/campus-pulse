"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/provider";
import { loginAction, type FormState } from "@/lib/actions/auth";

export function LoginForm({ from }: { from?: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, null);

  return (
    <div className="relative">
      {/* The column sits on the page's own grid — the same left edge as the
          wordmark — so the poster panel can run full-bleed to the far side.
          `min-h` minus the sticky header's 3.5rem fills the first screen, and
          `items-center` puts the form in the middle of it rather than hanging
          it off the top with the whole lower half empty. */}
      <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-6xl items-center px-4 py-14">
        <div className="w-full max-w-sm">
          <h1 className="text-[27px] font-extrabold leading-tight tracking-tight md:text-[32px]">
            {t("auth.login.title")}
          </h1>
          <p className="mt-2 text-muted">{t("auth.login.sub")}</p>

          <form action={formAction} className="mt-8 space-y-4">
            {/* Empty unless a protected page sent the visitor here. The server
                falls back to the role's own landing instead of assuming the
                student dashboard. */}
            <input type="hidden" name="from" value={from ?? ""} />
            <div>
              <label className="label" htmlFor="email">{t("auth.email")}</label>
              <input className="input" id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">{t("auth.password")}</label>
              <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            {state?.error && (
              <p className="text-sm text-danger" role="alert">{state.error}</p>
            )}
            <button className="btn btn-primary w-full" disabled={pending}>
              {pending ? t("auth.login.pending") : t("auth.login.submit")}
            </button>
          </form>

          <p className="mt-6 text-sm text-muted">
            {t("auth.login.noAccount")}{" "}
            <Link href="/register" className="font-semibold text-accent-dark">{t("nav.signup")}</Link>
          </p>
        </div>
      </div>

      {/* Poster panel: type and colour only — no photography, per the brief.
          Both lines are copy already approved on the landing, so nothing new
          is claimed here. The bar marks the panel's top edge and the type sits
          at the optical centre, level with the form, so neither column leaves a
          dead block. Placed after the form in the DOM so a screen reader
          reaches the task before the brand statement. */}
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
