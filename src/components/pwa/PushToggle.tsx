"use client";

import { useEffect, useState } from "react";
import { subscribePushAction, unsubscribePushAction } from "@/lib/actions/push";
import { useT, useLocale } from "@/i18n/provider";

/**
 * The bell panel's footer: switch web push on for this device.
 *
 * Sits inside the notification panel on purpose — it is offered exactly where
 * you are already looking at notifications, and it needs no page of settings
 * for a single binary choice.
 *
 * States, each with a deliberate render:
 *   unknown / unsupported  → renders NOTHING (before mount: no hydration
 *                            flash; after mount: no dead row on browsers
 *                            without push or on insecure origins)
 *   off                    → enable button (also the state where permission
 *                            is still "default" — subscribing asks)
 *   on                     → status + turn off
 *   blocked                → honest hint: permission was denied, only the
 *                            browser's own settings can undo that
 */

type State = "unknown" | "unsupported" | "off" | "on" | "blocked";

/** VAPID applicationServerKey is base64url; the API wants raw bytes. */
// `Uint8Array<ArrayBuffer>` (not plain `Uint8Array`, which is
// `ArrayBufferLike`): pushManager.subscribe() types BufferSource against a
// resizable ArrayBuffer in TS 5.7+, and a plain annotation won't assign.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function PushToggle() {
  const t = useT();
  const locale = useLocale();
  const [state, setState] = useState<State>("unknown");
  const [busy, setBusy] = useState(false);

  // Read the existing state once: is push even possible here, did this
  // browser already subscribe? getRegistration() (unlike .ready) resolves
  // immediately even when nothing was ever registered — no hanging spinner.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        !window.isSecureContext
      ) {
        if (alive) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (alive) setState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (alive) setState(sub ? "on" : "off");
      } catch {
        if (alive) setState("off");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "blocked" : "off");
        return;
      }
      // Register here too (the layout does it in prod, but a subscription
      // requires an ACTIVE worker regardless of where it came from).
      const reg = await navigator.serviceWorker.register("/sw.js");
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<ServiceWorkerRegistration | null>((resolve) =>
          setTimeout(() => resolve(null), 10_000)
        ),
      ]);
      if (!ready) return; // never activated: leave it off rather than half-subscribed

      const keyRes = await fetch("/api/push/public-key");
      const keyData = (await keyRes.json()) as { ok?: boolean; publicKey?: string };
      if (!keyData.ok || !keyData.publicKey) return; // server has no VAPID keys

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true, // every push must show a notification (browser rule)
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        });
      }
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      // The app's locale, not navigator.language: this student chose Arabic
      // in the app, so that's the language their phone should get.
      const res = await subscribePushAction({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        locale,
      });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        // Server first: if browser-unsubscribe won the race, a lingering row
        // would keep pushing at an endpoint that no longer exists (until the
        // push service retires it with a 410 — which we also handle).
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on"); // unknown outcome: don't claim it's off if it may not be
    } finally {
      setBusy(false);
    }
  };

  // No row at all until the state is known, and none where push can't work —
  // an empty footer rule would be decoration for its own sake.
  if (state === "unknown" || state === "unsupported") return null;

  return (
    // Closes the poster panel like the header opens it: paper strip under a
    // hard 2px ink rule, same 13px floor as every other panel line.
    <div className="flex items-center justify-between gap-3 border-t-2 border-ink bg-paper px-3 py-2.5">
      {state === "off" && (
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="text-[13px] font-semibold text-accent-dark underline-offset-2 hover:underline disabled:opacity-60"
        >
          {t("notif.push.enable")}
        </button>
      )}

      {state === "on" && (
        <>
          <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            {/* Same square accent dot as an unread row — decorative here; the
                words carry the state, never colour alone. */}
            <span className="h-2 w-2 bg-accent" aria-hidden="true" />
            {t("notif.push.on")}
          </span>
          <button
            type="button"
            onClick={() => void disable()}
            disabled={busy}
            className="text-[13px] font-semibold text-accent-dark underline-offset-2 hover:underline disabled:opacity-60"
          >
            {t("notif.push.off")}
          </button>
        </>
      )}

      {state === "blocked" && (
        <span className="text-[13px] text-muted">{t("notif.push.blocked")}</span>
      )}
    </div>
  );
}
