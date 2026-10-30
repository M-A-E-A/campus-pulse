"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";

/**
 * "Share poster": fetches the SVG and hands it to the Web Share API, where
 * the browser has one (mostly phones — with files support); everywhere else
 * the default anchor navigation opens the poster document itself, which is
 * also the print path: an SVG scales to any print size with no raster step.
 *
 * Built as an <a href> on purpose — the poster is a real URL, so it works
 * before hydration, with middle-click and copy-link, and it never trips a
 * popup blocker (window.open after an awaited fetch would).
 */
export function SharePosterButton({
  eventId,
  title,
}: {
  eventId: string;
  title: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const posterUrl = `/api/events/${eventId}/poster`;

  const share = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    // No sheet here → let the anchor do its honest default (open the poster).
    if (
      typeof navigator === "undefined" ||
      !("share" in navigator) ||
      typeof File === "undefined"
    ) {
      return;
    }
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(posterUrl);
      if (!res.ok) throw new Error(`poster ${res.status}`);
      const file = new File([await res.blob()], "campus-pulse-poster.svg", {
        type: "image/svg+xml",
      });
      if (!navigator.canShare?.({ files: [file] })) {
        window.open(posterUrl, "_blank", "noopener,noreferrer");
        return;
      }
      try {
        await navigator.share({ files: [file], title });
      } catch (err) {
        // Closing the share sheet IS the answer — only a capability failure
        // should fall through to opening the poster in a tab.
        if ((err as Error)?.name !== "AbortError") {
          window.open(posterUrl, "_blank", "noopener,noreferrer");
        }
      }
    } catch {
      window.open(posterUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <a
      href={posterUrl}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => void share(e)}
      aria-busy={busy}
      className="btn btn-secondary w-full border-2 border-ink bg-surface"
    >
      {busy ? t("detail.sharePosterBusy") : t("detail.sharePoster")}
    </a>
  );
}
