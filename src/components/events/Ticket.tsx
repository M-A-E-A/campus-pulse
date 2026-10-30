"use client";

import { useT } from "@/i18n/provider";
import { useTicketQr } from "@/components/tickets/useTicketQr";

export type TicketData = {
  rsvpId: string;
  ticketCode: string;
  checkedInAt: string | null;
  /** Present (and true) when the event was full: the student holds a
   *  queue spot, not a ticket. `rank` is their position (1 = next in). */
  waitlisted?: boolean;
  rank?: number;
  /** Formatted on the server (see events/[id]/page.tsx) so SSR and
   *  hydration always agree, regardless of client tzdata. */
  startsAtLabel: string;
  event: { title: string; startsAt: string; location: string; clubName: string };
};

/** The student's ticket: QR for the door scanner, code as fallback. */
export function Ticket({
  ticket,
  onCancel,
  busy,
}: {
  ticket: TicketData;
  onCancel: () => void;
  busy: boolean;
}) {
  const t = useT();
  const { qr, refreshing, degraded } = useTicketQr(
    ticket.rsvpId,
    ticket.ticketCode
  );

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="bg-accent-soft px-2.5 py-1 text-sm font-bold text-accent-dark">
          {t("detail.ticket.going")}
        </span>
        {ticket.checkedInAt && (
          <span className="border-2 border-success bg-white px-2.5 py-1 text-sm font-bold text-success">
            {t("detail.ticket.checkedIn")}
          </span>
        )}
      </div>
      <p className="mt-2 font-semibold">{ticket.event.title}</p>
      <p className="text-sm text-muted">
        {ticket.startsAtLabel} · {ticket.event.location}
      </p>

      <div className="mt-4 flex flex-col items-center gap-2 border-2 border-ink bg-white p-4">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={t("detail.ticket.qrAlt", { code: ticket.ticketCode })} width={180} height={180} />
        ) : (
          <div className="flex h-[180px] w-[180px] items-center justify-center text-sm text-muted">
            {t("detail.ticket.generating")}
          </div>
        )}
        <p className="font-mono text-xs tracking-widest text-muted break-all text-center">
          {ticket.ticketCode}
        </p>
        <p className="text-xs text-muted">{t("detail.ticket.showAtDoor")}</p>
        {qr && !degraded && (
          // Anti-screenshot note: only honest while the QR is actually a
          // signed rotating payload (raw-code fallback hides it).
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
            {/* Slow spin, not frantic: the QR turns every minute, not every frame. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="size-3.5 shrink-0 animate-spin [animation-duration:4s] motion-reduce:animate-none"
            >
              <path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" />
              <path d="M20.5 3.5v5h-5" />
            </svg>
            {refreshing ? t("qr.refreshing") : t("qr.hint")}
          </p>
        )}
        {qr && (
          <a
            href={qr}
            download={`ticket-${ticket.ticketCode}.png`}
            className="text-sm font-semibold text-accent-dark hover:underline"
          >
            {t("detail.ticket.saveQr")}
          </a>
        )}
      </div>

      <button
        className="btn btn-danger mt-4 w-full"
        onClick={onCancel}
        disabled={busy || Boolean(ticket.checkedInAt)}
        title={ticket.checkedInAt ? t("detail.ticket.alreadyCheckedIn") : undefined}
      >
        {busy ? t("detail.ticket.cancelling") : t("detail.ticket.cancel")}
      </button>
    </div>
  );
}
