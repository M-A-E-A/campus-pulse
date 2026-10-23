"use client";

import { useActionState } from "react";
import {
  createClubAction,
  promoteOrganizerAction,
  type RejectState,
} from "@/lib/actions/admin";
import { useT } from "@/i18n/provider";

export function ClubForms({ clubs }: { clubs: Array<{ id: string; name: string }> }) {
  const [clubState, createClub, clubPending] = useActionState<RejectState, FormData>(
    createClubAction,
    null
  );
  const [promoteState, promote, promotePending] = useActionState<RejectState, FormData>(
    promoteOrganizerAction,
    null
  );
  const t = useT();

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className="card p-5">
        <h2 className="font-semibold">{t("admin.clubs.newClub")}</h2>
        <form action={createClub} className="mt-3 space-y-3">
          <input className="input" name="name" placeholder={t("admin.clubs.namePh")} required />
          <textarea className="input min-h-20" name="description" placeholder={t("admin.clubs.descPh")} required />
          {clubState?.error && <p className="text-sm text-danger">{clubState.error}</p>}
          <button className="btn btn-primary w-full" disabled={clubPending}>
            {clubPending ? t("admin.clubs.creating") : t("admin.clubs.createBtn")}
          </button>
        </form>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">{t("admin.clubs.promoteTitle")}</h2>
        <p className="mt-1 text-xs text-muted">
          {t("admin.clubs.promoteHint")}
        </p>
        <form action={promote} className="mt-3 space-y-3">
          <input className="input" name="email" type="email" placeholder={t("admin.clubs.emailPh")} required />
          <select className="input" name="clubId" required defaultValue="">
            <option value="" disabled>{t("admin.clubs.pickClub")}</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {promoteState?.error && <p className="text-sm text-danger">{promoteState.error}</p>}
          <button className="btn btn-primary w-full" disabled={promotePending}>
            {promotePending ? t("admin.clubs.promoting") : t("admin.clubs.promoteBtn")}
          </button>
        </form>
      </div>
    </div>
  );
}
