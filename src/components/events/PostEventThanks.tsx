"use client";

import { useState } from "react";
import Link from "next/link";
import { feedbackAction } from "@/lib/actions/feedback";
import { isOfflineError } from "@/lib/offline";
import { useT } from "@/i18n/provider";

/**
 * The post-event thank-you band — the Phase 7 "thank-you screen". It is
 * rendered only once the event has ENDED, for the signed-in visitor's own
 * CONFIRMED ticket, and sits full-bleed under the facts rail so the poster
 * gains a closing cover instead of a sidebar footnote.
 *
 * It asks "would you attend again?"; the answer lands on the RSVP
 * (attendAgain + feedbackAt) and feeds the dashboard's "Because you liked…"
 * recommendations. A yes surfaces that club's next event right here, so the
 * loop closes where it was opened. Re-answering goes through "change my
 * answer" — one question, two honest outcomes, no stars theatre.
 */
export function PostEventThanks({
  eventId,
  clubName,
  attended,
  initialAnswer,
  nextUp,
}: {
  eventId: string;
  /** The club whose next event a "yes" points at (passed separately so the
   *  label reads even while nextUp is still loading-free/absent). */
  clubName: string;
  /** checkedInAt was set: "thanks for coming" vs the no-show's honest
   *  "thanks for signing up". */
  attended: boolean;
  /** Stored answer; null while the question is still unanswered. */
  initialAnswer: boolean | null;
  /** This club's next published event (own ticket excluded), dates already
   *  formatted server-side in the page locale — never format on the client. */
  nextUp: { id: string; title: string; dateLabel: string } | null;
}) {
  const t = useT();
  const [answer, setAnswer] = useState<boolean | null>(initialAnswer);
  const [editing, setEditing] = useState(false);
  // Which answer is in flight (null = idle) — the spinner rides the button
  // that was clicked, same as RsvpSection's busy button.
  const [busy, setBusy] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const asking = answer === null || editing;

  async function respond(value: boolean) {
    setBusy(value);
    setError(null);
    try {
      const result = await feedbackAction(eventId, value);
      if (result.ok) {
        setAnswer(value);
        setEditing(false);
      } else {
        setError(result.message);
      }
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      setError(t("errors.offline"));
    }
    setBusy(null);
  }

  return (
    <div className="field-ink" data-post="thanks" data-rise>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="display-chapter text-balance">
          {attended
            ? t("detail.post.thanksAttended")
            : t("detail.post.thanksRegistered")}
        </h2>

        {asking ? (
          <>
            <p className="mt-4 text-[length:var(--step-lead)] font-semibold text-paper/90">
              {t("detail.post.question")}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => respond(true)}
                disabled={busy !== null}
                data-post="yes"
              >
                {busy === true && <span className="spinner" aria-hidden="true" />}
                {t("detail.post.yes")}
              </button>
              <button
                type="button"
                className="btn btn-secondary border-paper/40 text-paper hover:border-paper"
                onClick={() => respond(false)}
                disabled={busy !== null}
                data-post="no"
              >
                {busy === false && <span className="spinner" aria-hidden="true" />}
                {t("detail.post.no")}
              </button>
            </div>
          </>
        ) : (
          <div data-post="answered">
            <p className="mt-4 text-[length:var(--step-lead)] font-bold text-accent">
              {t("detail.post.answered")}
            </p>
            {answer && nextUp && (
              <p className="mt-3 text-paper/85" data-post="next">
                {t("detail.post.next", { club: clubName })}{" "}
                <Link
                  href={`/events/${nextUp.id}`}
                  className="font-semibold underline underline-offset-4 hover:text-accent"
                >
                  {nextUp.title} — {nextUp.dateLabel} →
                </Link>
              </p>
            )}
            <button
              type="button"
              className="btn btn-secondary mt-5 border-paper/40 text-paper hover:border-paper"
              onClick={() => setEditing(true)}
              data-post="change"
            >
              {t("detail.post.change")}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-paper/75" role="status">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
