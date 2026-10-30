"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { useTicketQr } from "@/components/tickets/useTicketQr";
import { WakeLock } from "@/components/tickets/WakeLock";
import { purgeTicketCache } from "@/lib/ticket-cache";
import type { TicketData } from "@/components/events/Ticket";

/**
 * The QR half of the standalone ticket: bigger than the inline panel on
 * the event page (this one is read from arm's length in a queue), plus the
 * two things a door actually needs — a screen that stays awake, and an
 * honest banner when the mint route can't be reached.
 *
 * Offline behaviour is inherited, not re-invented: `useTicketQr` degrades
 * to the RAW ticket code when minting fails, and the check-in action
 * accepts raw codes (`ticketCode.includes("|")` gate), so the door still
 * works with no signal. The anti-screenshot hint is suppressed while
 * degraded, because claiming rotation over a static code would be a lie.
 */
export function TicketFull({
  ticket,
  eventHref,
}: {
  ticket: TicketData;
  eventHref: string;
}) {
  const t = useT();
  const { qr, refreshing, degraded } = useTicketQr(
    ticket.rsvpId,
    ticket.ticketCode
  );
  const [online, setOnline] = useState(true);
  const [forgotten, setForgotten] = useState(false);

  // Report connectivity truthfully: the banner is the only way a student
  // standing in a dead-wifi lobby learns WHY the QR stopped rotating.
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return (
    <div data-fullticket>
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-accent-soft px-2.5 py-1 text-sm font-bold text-accent-dark">
          {t("detail.ticket.going")}
        </span>
        {ticket.checkedInAt && (
          <span className="border-2 border-success bg-white px-2.5 py-1 text-sm font-bold text-success">
            {t("detail.ticket.checkedIn")}
          </span>
        )}
      </div>

      {!online && (
        <p
          className="mt-3 border-2 border-ink bg-accent-soft px-3 py-2 text-sm font-semibold"
          data-ticketoffline
        >
          {t("ticket.offlineBanner")}
        </p>
      )}

      <div className="mt-4 flex flex-col items-center gap-3 border-2 border-ink bg-white p-4">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt={t("detail.ticket.qrAlt", { code: ticket.ticketCode })}
            width={300}
            height={300}
            data-qr
            className="h-auto w-full max-w-[300px]"
          />
        ) : (
          <div className="flex h-[240px] w-full max-w-[300px] items-center justify-center text-sm text-muted">
            {t("detail.ticket.generating")}
          </div>
        )}
        <p
          className="break-all text-center font-mono text-base font-bold tracking-widest"
          data-code
        >
          {ticket.ticketCode}
        </p>
        <p className="text-sm text-muted">{t("ticket.showAtDoor")}</p>
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

      <div className="mt-4">
        <WakeLock />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Link href={eventHref} className="btn btn-secondary w-full">
          {t("ticket.backToEvent")}
        </Link>
        <button
          type="button"
          className="btn btn-secondary w-full"
          data-forget
          onClick={async () => {
            await purgeTicketCache();
            setForgotten(true);
          }}
        >
          {forgotten ? t("ticket.forgotten") : t("ticket.forget")}
        </button>
      </div>
    </div>
  );
}
