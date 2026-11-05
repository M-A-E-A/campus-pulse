"use client";

import { useActionState } from "react";
import { useT } from "@/i18n/provider";
import { creatorLoginAction, type CreatorFormState } from "@/lib/actions/creator";
import { isOfflineError } from "@/lib/offline";

export function CreatorLoginForm({ from }: { from?: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<CreatorFormState, FormData>(
    // Same rule as the app login: a server action with no network rejects
    // with TypeError — that is an offline STATE, not a crash, and the form
    // says so in its own alert slot.
    async (prev, formData) => {
      try {
        return await creatorLoginAction(prev, formData);
      } catch (err) {
        if (isOfflineError(err)) return { error: t("errors.offline") };
        throw err;
      }
    },
    null
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {/* Only ever an in-app path; the action re-validates it anyway. */}
      <input type="hidden" name="from" value={from ?? ""} />
      <div>
        <label className="label" htmlFor="creator-login">
          {t("creator.login.login")}
        </label>
        <input
          className="input"
          id="creator-login"
          name="login"
          type="text"
          required
          autoComplete="username"
        />
      </div>
      <div>
        <label className="label" htmlFor="creator-password">
          {t("creator.login.password")}
        </label>
        <input
          className="input"
          id="creator-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? t("creator.login.pending") : t("creator.login.submit")}
      </button>
    </form>
  );
}
