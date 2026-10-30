"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";

/**
 * Keeps the screen awake while the ticket is held up at the door.
 *
 * A wake lock is not a permission prompt — the browser grants it silently
 * and revokes it the moment the page hides — so unlike geolocation there
 * is no consent dialog to gate behind. There IS still a switch: an
 * unnoticed lock is a silent battery drain, so it starts off, one tap turns
 * it on, and the browser's own `visibilitychange` drop is re-acquired
 * there, which is exactly when it happens.
 *
 * Feature-detected: Firefox and older Safari have no `wakeLock`, and the
 * page must say so honestly rather than offer a switch that does nothing.
 */
export function WakeLock() {
  const t = useT();
  const [supported] = useState(
    typeof navigator !== "undefined" && "wakeLock" in navigator
  );
  const [enabled, setEnabled] = useState(false);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!supported || !enabled) return;
    let disposed = false;
    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request("screen");
        if (disposed) {
          // Toggled off while the request was in flight.
          void s.release();
          return;
        }
        sentinel = s;
        s.addEventListener("release", () => {
          if (sentinel === s) sentinel = null;
          // The browser drops the lock on hide/background: report the truth
          // rather than leaving a stale "on" indicator lit.
          if (!disposed) setHeld(false);
        });
        setHeld(true);
      } catch {
        // Denied (battery saver, backgrounded tab, no permission): the
        // switch stays on but the state says what actually happened.
        if (!disposed) setHeld(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release();
      sentinel = null;
    };
  }, [supported, enabled]);

  if (!supported) {
    return <p className="text-sm text-muted">{t("ticket.wakeUnsupported")}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        aria-pressed={enabled}
        data-wake={enabled ? "on" : "off"}
        onClick={() => setEnabled((v) => !v)}
        className={`btn ${enabled ? "btn-primary" : "btn-secondary"} w-full`}
      >
        {t("ticket.wakeLabel")}
      </button>
      {/* Three honest states: off = what the switch does, on+held = it is
          doing it, on+denied = this browser won't. Never a stale "on". */}
      <p className="text-center text-xs text-muted">
        {enabled && !held
          ? t("ticket.wakeUnsupported")
          : t("ticket.wakeHint")}
      </p>
    </div>
  );
}
