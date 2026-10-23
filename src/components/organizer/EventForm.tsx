"use client";

import { useActionState } from "react";
import {
  createEventAction,
  updateEventAction,
  type EventFormState,
} from "@/lib/actions/events";
import { useT } from "@/i18n/provider";

type Category = { id: string; name: string };

type ExistingEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  capacity: number | null;
  categoryId: string;
  coverImage: string | null;
};

/**
 * One form for create and edit. Date inputs use datetime-local; the server
 * interprets them in the campus time zone (see src/lib/tz.ts).
 */
export function EventForm({
  mode,
  clubId,
  eventId,
  categories,
  event,
  localStart,
  localEnd,
}: {
  mode: "create" | "edit";
  clubId: string;
  eventId?: string;
  categories: Category[];
  event?: ExistingEvent;
  /** Pre-formatted in the campus time zone by the server. */
  localStart?: string;
  localEnd?: string;
}) {
  const action = mode === "create" ? createEventAction : updateEventAction;
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(action, null);
  const t = useT();

  return (
    <form action={formAction} className="space-y-5">
      {mode === "create" && <input type="hidden" name="clubId" value={clubId} />}
      {mode === "edit" && eventId && <input type="hidden" name="eventId" value={eventId} />}

      <div>
        <label className="label" htmlFor="title">{t("org.form.title")}</label>
        <input
          className="input" id="title" name="title" required maxLength={120}
          defaultValue={event?.title}
          placeholder={t("org.form.titlePh")}
        />
      </div>

      <div>
        <label className="label" htmlFor="description">{t("org.form.description")}</label>
        <textarea
          className="input min-h-32" id="description" name="description" required
          defaultValue={event?.description}
          placeholder={t("org.form.descriptionPh")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="startsAt">{t("org.form.starts")}</label>
          <input
            className="input" id="startsAt" name="startsAt" type="datetime-local" required
            defaultValue={localStart}
          />
        </div>
        <div>
          <label className="label" htmlFor="endsAt">{t("org.form.ends")}</label>
          <input
            className="input" id="endsAt" name="endsAt" type="datetime-local" required
            defaultValue={localEnd}
          />
          <p className="mt-1 text-xs text-muted">{t("org.form.campusTz", { tz: process.env.NEXT_PUBLIC_CAMPUS_TZ ?? "Africa/Casablanca" })}</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="location">{t("org.form.location")}</label>
          <input
            className="input" id="location" name="location" required
            defaultValue={event?.location}
            placeholder={t("org.form.locationPh")}
          />
        </div>
        <div>
          <label className="label" htmlFor="capacity">{t("org.form.capacity")}</label>
          <input
            className="input" id="capacity" name="capacity" type="number" min={1}
            defaultValue={event?.capacity ?? ""}
            placeholder={t("org.form.capacityPh")}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="categoryId">{t("org.form.category")}</label>
        <select className="input" id="categoryId" name="categoryId" required defaultValue={event?.categoryId ?? ""}>
          <option value="" disabled>{t("org.form.categoryPick")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="coverImage">{t("org.form.cover")}</label>
        <input className="input" id="coverImage" name="coverImage" type="file" accept="image/*" />
        {event?.coverImage && (
          <p className="mt-1 text-xs text-muted">{t("org.form.coverKept")}</p>
        )}
      </div>

      {state?.error && (
        <p className="rounded-lg bg-[#fdecea] px-4 py-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <button className="btn btn-primary" disabled={pending}>
          {pending
            ? mode === "create" ? t("org.form.creating") : t("org.form.saving")
            : mode === "create" ? t("org.form.saveDraft") : t("org.form.saveChanges")}
        </button>
      </div>
    </form>
  );
}
