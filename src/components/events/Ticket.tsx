"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";

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
  /** String currently encoded in the QR: a signed time-slot payload when
   *  the mint route answers, the raw code when it doesn't. */
  const [encoded, setEncoded] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /** True while the QR encodes the raw code instead of a signed payload —
   *  the anti-screenshot hint would be a lie then, so we hide it. */
  const [degraded, setDegraded] = useState(false);

  // Mint loop: fetch a signed payload now, then every 20 s (or right when
  // the 60 s slot ends, if that's sooner), so a screenshot of yesterday's
  // QR stops verifying while the live ticket keeps working.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      setRefreshing(true);
      try {
        const res = await fetch(`/api/tickets/${ticket.rsvpId}/qr`, { cache: "no-store" });
        if (!res.ok) throw new Error(`mint failed: ${res.status}`);
        const data = (await res.json()) as { payload: string; expiresInSec: number };
        if (cancelled) return;
        setEncoded(data.payload);
        setDegraded(false);
        timer = setTimeout(refresh, Math.min(20, data.expiresInSec) * 1000);
      } catch (err) {
        // Minting failed (offline, server hiccup): encode the raw code —
        // the door still accepts manual codes, the QR just degrades.
        console.error("QR mint failed, falling back to raw code:", err);
        if (cancelled) return;
        setEncoded(ticket.ticketCode);
        setDegraded(true);
        // Keep retrying so the signed QR comes back without a reload.
        timer = setTimeout(refresh, 20_000);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };

    void refresh();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ticket.rsvpId, ticket.ticketCode]);

  // Regenerate the dataURL whenever the encoded string changes.
  // qrcode (~18 kB) is fetched on demand — it isn't needed until a
  // ticket actually appears on screen.
  useEffect(() => {
    if (encoded === null) return;
    let cancelled = false;
    void (async () => {
      const mod = await import("qrcode");
      // Interop-safe: use the default export when present, else the module.
      const QRCode = mod.default ?? mod;
      const url = await QRCode.toDataURL(encoded, {
        width: 320,
        margin: 1,
        color: { dark: "#14130f", light: "#ffffff" },
      });
      if (!cancelled) setQr(url);
    })().catch((err) => {
      console.error("QR generation failed:", err);
      if (!cancelled) setQr(null);
    });
    return () => {
      cancelled = true;
    };
  }, [encoded]);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="badge bg-accent-soft text-accent-dark">{t("detail.ticket.going")}</span>
        {ticket.checkedInAt && (
          <span className="badge bg-[#e6f4ea] text-[color:var(--color-success)]">{t("detail.ticket.checkedIn")}</span>
        )}
      </div>
      <p className="mt-2 font-semibold">{ticket.event.title}</p>
      <p className="text-sm text-muted">
        {ticket.startsAtLabel} · {ticket.event.location}
      </p>

      <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-line bg-white p-4">
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
