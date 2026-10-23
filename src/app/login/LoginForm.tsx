"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/provider";
import { loginAction, type FormState } from "@/lib/actions/auth";

export function LoginForm({ from }: { from?: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, null);

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-3xl font-bold">{t("auth.login.title")}</h1>
      <p className="mt-2 text-muted">{t("auth.login.sub")}</p>

      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="from" value={from ?? "/dashboard"} />
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
  );
}
