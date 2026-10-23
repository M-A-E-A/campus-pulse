"use client";

import { useActionState } from "react";
import { createCategoryAction, type RejectState } from "@/lib/actions/admin";
import { useT } from "@/i18n/provider";

export function CategoryForm() {
  const [state, formAction, pending] = useActionState<RejectState, FormData>(
    createCategoryAction,
    null
  );
  const t = useT();

  return (
    <form action={formAction} className="flex gap-2">
      <input className="input" name="name" placeholder={t("admin.categories.ph")} required />
      <button className="btn btn-primary shrink-0" disabled={pending}>
        {pending ? t("admin.categories.adding") : t("admin.categories.add")}
      </button>
      {state?.error && <p className="self-center text-sm text-danger">{state.error}</p>}
    </form>
  );
}
