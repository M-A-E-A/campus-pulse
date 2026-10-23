"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/provider";
import { registerAction, type FormState } from "@/lib/actions/auth";

export function RegisterForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(registerAction, null);

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-3xl font-bold">{t("auth.register.title")}</h1>
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
          <p className="mt-1 text-xs text-muted">{t("auth.passwordHint")}</p>
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
  );
}
