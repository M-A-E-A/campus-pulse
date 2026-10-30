"use client";

import { useEffect, useState } from "react";

/**
 * The rotating-QR half of a ticket, shared by the inline panel on the
 * event page (`events/Ticket.tsx`) and the standalone full-screen wallet
 * page (`tickets/[rsvpId]`) so the two can never drift apart.
 *
 * Returns the PNG dataURL to render, whether a refresh is in flight, and
 * whether the QR currently encodes the RAW ticket code instead of a
 * signed rotating payload (offline / mint failure). Callers must treat
 * `degraded` as "the anti-screenshot claim would be a lie" and hide it.
 */
export function useTicketQr(rsvpId: string, ticketCode: string) {
  /** String currently encoded in the QR: a signed time-slot payload when
   *  the mint route answers, the raw code when it doesn't. */
  const [encoded, setEncoded] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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
        const res = await fetch(`/api/tickets/${rsvpId}/qr`, { cache: "no-store" });
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
        setEncoded(ticketCode);
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
  }, [rsvpId, ticketCode]);

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

  return { qr, refreshing, degraded };
}
