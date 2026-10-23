"use client";

import { useActionState, useState } from "react";
import { rejectEventAction, type RejectState } from "@/lib/actions/admin";
import { useT } from "@/i18n/provider";

/** Approve needs no input; reject demands a reason the organizer will see. */
export function RejectForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<RejectState, FormData>(
    rejectEventAction,
    null
  );
  const t = useT();

  if (!open) {
    return (
      <button className="btn btn-danger" onClick={() => setOpen(true)}>
        {t("admin.reject.open")}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex-1 min-w-64">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="label" htmlFor={`reason-${eventId}`}>
        {t("admin.reject.reasonLabel")}
      </label>
      <textarea
        className="input min-h-20"
        id={`reason-${eventId}`}
        name="reason"
        required
        placeholder={t("admin.reject.reasonPh")}
      />
      {state?.error && (
        <p className="mt-1 text-sm text-danger" role="alert">{state.error}</p>
      )}
      <div className="mt-2 flex gap-2">
        <button className="btn btn-danger" disabled={pending}>
          {pending ? t("admin.reject.pending") : t("admin.reject.confirm")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
          {t("admin.reject.cancel")}
        </button>
      </div>
    </form>
  );
}
