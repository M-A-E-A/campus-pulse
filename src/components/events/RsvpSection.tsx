"use client";

import { useState } from "react";
import Link from "next/link";
import { rsvpAction, cancelRsvpAction } from "@/lib/actions/rsvp";
import { useT } from "@/i18n/provider";
import { isOfflineError } from "@/lib/offline";
import { Ticket, type TicketData } from "./Ticket";

/**
 * RSVP button + ticket. Optimistic-free on purpose: the server transaction
 * is the source of truth for capacity, so we always wait for its answer.
 * When the event is full the button joins a waitlist instead, and a
 * waitlisted "ticket" renders a queue panel (no QR) until promotion.
 */
export function RsvpSection({
  eventId,
  isAuthenticated,
  existingRsvp,
  startsAtLabel,
  isFull = false,
}: {
  eventId: string;
  isAuthenticated: boolean;
  existingRsvp: TicketData | null;
  /** Server-formatted event time, reused for tickets fetched after RSVP. */
  startsAtLabel: string;
  /** Confirmed count reached capacity: the button becomes "join the waitlist". */
  isFull?: boolean;
}) {
  const t = useT();
  const [ticket, setTicket] = useState<TicketData | null>(existingRsvp);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Send the visitor back to this event after signing in, not to a dashboard.
  const loginHref = `/login?from=${encodeURIComponent(`/events/${eventId}`)}`;

  async function handleRsvp() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await rsvpAction(eventId);
      if (result.ok) {
        // Fetch the fresh ticket (the code was generated server-side).
        const res = await fetch(`/api/events/${eventId}/ticket`);
        if (res.ok) {
          const data = await res.json();
          // Reuse the server-formatted label — never format this on the client.
          setTicket({ ...data, startsAtLabel });
          // Waitlisted? Use the server's translated message ("you've joined
          // the waitlist") instead of the confirmed-ticket copy.
          setMessage(data.waitlisted ? result.message : t("detail.rsvp.joined"));
        }
      } else {
        setMessage(result.message);
      }
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      setMessage(t("errors.offline"));
    }
    setBusy(false);
  }

  async function handleCancel() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await cancelRsvpAction(eventId);
      if (result.ok) {
        setTicket(null);
        setMessage(t("detail.rsvp.cancelledReturn"));
      } else {
        setMessage(result.message);
      }
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      setMessage(t("errors.offline"));
    }
    setBusy(false);
  }

  if (!isAuthenticated) {
    return (
      <div className="border-2 border-ink bg-surface p-5">
        <p className="font-semibold">{t("detail.rsvp.wantToGo")}</p>
        <p className="mt-1 text-sm text-muted">{t("detail.rsvp.loginPrompt")}</p>
        <a href={loginHref} className="btn btn-primary mt-4 min-h-11 w-full">{t("detail.rsvp.loginToRsvp")}</a>
      </div>
    );
  }

  return (
    <div className="border-2 border-ink bg-surface p-5">
      {ticket?.waitlisted ? (
        /* Queue spot, not a ticket: badge + explanation, no QR. */
        <div>
          <span className="bg-ink px-2.5 py-1 text-sm font-bold text-paper">
            {t("detail.rsvp.waitlistBadge", { n: ticket.rank ?? 1 })}
          </span>
          <p className="mt-2 font-semibold">{ticket.event.title}</p>
          <p className="text-sm text-muted">
            {ticket.startsAtLabel} · {ticket.event.location}
          </p>
          <p className="mt-3 text-sm text-muted">{t("detail.rsvp.waitlistHint")}</p>
          <button
            className="btn btn-secondary mt-4 min-h-11 w-full"
            onClick={handleCancel}
            disabled={busy}
          >
            {busy ? t("detail.ticket.cancelling") : t("detail.rsvp.leaveWaitlist")}
          </button>
        </div>
      ) : ticket ? (
        <div>
          <Ticket ticket={ticket} onCancel={handleCancel} busy={busy} />
          {/* Standalone wallet page: same ticket, full-screen, cached by the
              service worker so it still opens when the venue has no signal. */}
          <Link
            href={`/tickets/${ticket.rsvpId}`}
            className="mt-4 inline-block text-sm font-semibold text-accent-dark hover:underline"
            data-fullscreen-ticket
          >
            {t("ticket.fullScreen")}
          </Link>
        </div>
      ) : (
        <>
          <p className="font-semibold">{t("detail.rsvp.notYet")}</p>
          <p className="mt-1 text-sm text-muted">
            {t("detail.rsvp.cta")}
          </p>
          <button className="btn btn-primary mt-4 min-h-11 w-full" onClick={handleRsvp} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy
              ? t("detail.rsvp.busy")
              : t(isFull ? "detail.rsvp.joinWaitlist" : "detail.rsvp.button")}
          </button>
        </>
      )}
      {message && <p className="mt-3 text-sm text-muted" role="status">{message}</p>}
    </div>
  );
}
