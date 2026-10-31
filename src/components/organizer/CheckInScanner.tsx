"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkInAction, type CheckInResult } from "@/lib/actions/checkin";
import { useT } from "@/i18n/provider";
import { isOfflineError } from "@/lib/offline";
import { CameraError, startQrCamera, type QrCamera, type QrCameraMode } from "@/lib/qr-camera";
import {
  enqueueScan,
  queueForEvent,
  removeScan,
  type PendingScan,
} from "@/lib/checkin-queue";

type ScanOutcome = {
  result: CheckInResult;
  at: string;
};

/** QR payloads are `code|bucket|hmac` — the list shows a prefix, the full
 *  code stays in the title attribute for the "why did that fail?" read. */
function shortCode(code: string): string {
  return code.length > 16 ? `${code.slice(0, 16)}…` : code;
}

/**
 * Door screen. Camera scanner on top (native BarcodeDetector first, the
 * html5-qrcode fallback behind it — see qr-camera.ts), manual code entry
 * underneath: cameras fail on http://LAN opens and in some browsers, and
 * the manual box is the fallback that saves the demo.
 *
 * A camera QR decodes ~10 times a second while it's held in view, so
 * camera scans carry a per-code cooldown (manual entry deliberately
 * doesn't — retyping the same code IS the signal). The insecure origin
 * is caught BEFORE getUserMedia ever runs and said in words.
 *
 * Offline contract: a scan that can't reach the server is QUEUED locally
 * (see checkin-queue.ts) — never dropped — and re-sent automatically.
 * The server is idempotent, so replays and mid-outage conflicts come back
 * as honest result rows ("duplicate" when someone else got there first).
 */
export function CheckInScanner({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [history, setHistory] = useState<ScanOutcome[]>([]);
  const [pending, setPending] = useState<PendingScan[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncBlockedCount, setSyncBlockedCount] = useState<number | null>(null);
  const [queueError, setQueueError] = useState(false);
  const [cameraMode, setCameraMode] = useState<QrCameraMode | null>(null);
  const cameraRef = useRef<QrCamera | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false); // ignore frames while one is in flight
  const lastCameraScan = useRef({ text: "", at: 0 }); // camera cooldown
  const syncingRef = useRef(false);
  const t = useT();

  // Latest outcome drives the big banner (green/red).
  const latest = history[0];

  const refreshPending = useCallback(() => {
    setPending(queueForEvent(eventId));
  }, [eventId]);

  /** Drain this event's queue, oldest first, one scan at a time (door Wi-Fi).
   *  Stops — and keeps the rest — when the network dies again or the session
   *  does; every other outcome lands in the history as the honest result. */
  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const items = queueForEvent(eventId);
    if (items.length === 0) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncBlockedCount(null);
    try {
      for (const item of items) {
        let result: CheckInResult;
        try {
          result = await checkInAction(eventId, item.code);
        } catch (err) {
          if (isOfflineError(err)) break; // network died again — keep the rest
          throw err; // real crash → error boundary; queue survives in storage
        }
        if (result.status === "unauthorized" || result.status === "forbidden") {
          // Auth died mid-outage. Sending the remaining scans into a wall of
          // "session expired" would bury real people's check-ins — keep the
          // queue and say why; logging in again drains it.
          setSyncBlockedCount(items.length);
          break;
        }
        removeScan(item.id);
        // The row carries the DOOR time, not the sync time: that's when the
        // person actually stood there.
        setHistory((h) => [{ result, at: item.at }, ...h.slice(0, 19)]);
        refreshPending();
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      refreshPending();
    }
  }, [eventId, refreshPending]);

  async function submitCode(raw: string) {
    const code = raw.trim();
    if (!code || busyRef.current) return;
    busyRef.current = true;
    setQueueError(false);
    try {
      const result = await checkInAction(eventId, code);
      setHistory((h) => [
        { result, at: new Date().toLocaleTimeString() },
        ...h.slice(0, 19),
      ]);
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      // The venue Wi-Fi died mid-door: queue the scan instead of dropping
      // the person. Drained on `online`, on reload, or by the Sync button.
      const kept = enqueueScan({ eventId, code });
      setQueueError(!kept);
      refreshPending();
    }
    busyRef.current = false;
  }

  /** Camera decode callback: busyRef only covers the in-flight window, so a
   *  QR held in view for the ten seconds it takes to answer would pile up
   *  "duplicate" rows the moment the first response lands. The cooldown is
   *  what holds that flood back — a DIFFERENT code scans instantly. Manual
   *  entry bypasses it on purpose: retyping the same code is a signal. */
  function onCameraText(text: string) {
    const now = Date.now();
    if (text === lastCameraScan.current.text && now - lastCameraScan.current.at < 3000) {
      return;
    }
    lastCameraScan.current = { text, at: now };
    if (!busyRef.current) void submitCode(text);
  }

  async function startScanner() {
    const container = readerRef.current;
    if (!container) return;
    setCameraError(null);
    try {
      const camera = await startQrCamera({ container, onText: onCameraText });
      cameraRef.current = camera;
      setCameraMode(camera.mode);
      setScanning(true);
    } catch (err) {
      console.error("Camera start failed:", err);
      setCameraError(
        err instanceof CameraError
          ? t("common.cameraInsecure")
          : t("org.checkin.cameraError")
      );
      setScanning(false);
    }
  }

  async function stopScanner() {
    await cameraRef.current?.stop();
    cameraRef.current = null;
    setCameraMode(null);
    setScanning(false);
  }

  // Never leave the camera running when the component unmounts.
  useEffect(() => {
    return () => {
      void cameraRef.current?.stop();
    };
  }, []);

  // Hydrate the queue (localStorage, post-mount — SSR renders it empty),
  // then drain it if we have network: a reload mid-outage must not leave
  // scans stranded once connectivity is back.
  useEffect(() => {
    refreshPending();
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void syncQueue();
    }
    const onOnline = () => {
      void syncQueue();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refreshPending, syncQueue]);

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <a href="/organizer" className="text-sm text-muted hover:text-ink">{t("org.back")}</a>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("org.checkin.header")}</h1>
      <p className="mt-1 text-muted">{t("org.checkin.sub", { title: eventTitle })}</p>

      {/* Result banner */}
      {latest && (
        <div
          role="status"
          data-checkinbanner
          data-status={latest.result.status}
          className={`mt-6 rounded-xl px-5 py-4 font-semibold ${
            latest.result.status === "ok"
              ? "bg-[#e6f4ea] text-[color:var(--color-success)]"
              : latest.result.status === "duplicate" || latest.result.status === "expired" || latest.result.status === "waitlisted"
                ? "bg-[#fff3cd] text-[#8a6d00]"
                : "bg-[#fdecea] text-[color:var(--color-danger)]"
          }`}
        >
          {latest.result.status === "ok" && (
            <span className="inline-flex items-center gap-2">
              {/* Drawn check, not a ✓ glyph — the door scanner's green
                  banner keeps its scannable mark without an emoji. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {t("org.checkin.ok", { name: latest.result.name })}
            </span>
          )}
          {latest.result.status === "duplicate" && t("org.checkin.duplicate", { name: latest.result.name })}
          {latest.result.status === "waitlisted" && t("qr.checkin.waitlisted", { name: latest.result.name })}
          {latest.result.status === "invalid" && t("org.checkin.invalid")}
          {latest.result.status === "cancelled" && t("org.checkin.cancelled")}
          {latest.result.status === "expired" && t("qr.checkin.expired")}
          {latest.result.status === "forbidden" && t("org.checkin.forbidden")}
          {latest.result.status === "unauthorized" && t("org.checkin.unauthorized")}
        </div>
      )}

      {/* Queued scans — the offline contract in one slot: kept, counted,
          drained automatically. Amber, not red: attention, not failure. */}
      {pending.length > 0 && (
        <div
          role="status"
          data-checkinqueue
          className="mt-6 rounded-xl bg-[#fff3cd] px-5 py-4 text-[#8a6d00]"
        >
          <p className="font-semibold" data-pendingcount={pending.length}>
            {t("org.checkin.pendingCard", { count: pending.length })}
          </p>
          <button
            type="button"
            className="btn btn-secondary mt-3"
            data-sync
            disabled={syncing}
            onClick={() => void syncQueue()}
          >
            {syncing ? t("org.checkin.syncing") : t("org.checkin.sync")}
          </button>
        </div>
      )}

      {/* Session died mid-drain: the queue is still here, honestly said. */}
      {syncBlockedCount !== null && (
        <div
          role="alert"
          data-syncblocked
          className="mt-6 rounded-xl bg-[#fdecea] px-5 py-4 font-semibold text-[color:var(--color-danger)]"
        >
          {t("org.checkin.syncBlocked", { count: syncBlockedCount })}
        </div>
      )}

      {/* Storage refused the queue — the scan was genuinely lost; say so. */}
      {queueError && (
        <div
          role="alert"
          data-queueerror
          className="mt-6 rounded-xl bg-[#fdecea] px-5 py-4 font-semibold text-[color:var(--color-danger)]"
        >
          {t("org.checkin.queueFull")}
        </div>
      )}

      {/* Camera — the card wears data-scanmode so a probe can tell which
          decoder (native / legacy) is actually driving this browser. */}
      <div className="card mt-6 overflow-hidden" data-scancard data-scanmode={cameraMode ?? undefined}>
        <div
          ref={readerRef}
          id="qr-reader"
          className="min-h-64 bg-ink/90 [&_video]:!h-auto [&_video]:!w-full"
        />
        {!scanning && (
          <div className="flex flex-col items-center gap-3 p-6">
            <p className="text-sm text-muted" data-cameramsg>
              {cameraError ?? t("org.checkin.cameraHint")}
            </p>
            <button className="btn btn-primary" data-startcamera onClick={startScanner}>
              {t("org.checkin.startCamera")}
            </button>
          </div>
        )}
        {scanning && (
          <div className="flex justify-center p-4">
            <button className="btn btn-secondary" data-stopcamera onClick={stopScanner}>{t("org.checkin.stopCamera")}</button>
          </div>
        )}
      </div>

      {/* Manual fallback */}
      <form
        className="card mt-4 flex gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submitCode(manualCode);
          setManualCode("");
        }}
      >
        <input
          className="input"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder={t("org.checkin.codePh")}
          aria-label={t("org.checkin.codeLabel")}
        />
        <button className="btn btn-primary shrink-0">{t("org.checkin.manualSubmit")}</button>
      </form>

      {/* Recent scans: queued ones wear the amber "waiting" label until the
          server answers, then take their real row like any other scan. */}
      {(history.length > 0 || pending.length > 0) && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{t("org.checkin.recent")}</h2>
          <ul className="mt-2 divide-y divide-line">
            {pending.map((p) => (
              <li
                key={p.id}
                data-pendingitem
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="font-semibold text-[#8a6d00]" title={p.code}>
                  {shortCode(p.code)} — {t("org.checkin.pendingItem")}
                </span>
                <span className="text-muted">
                  {new Date(p.at).toLocaleTimeString()}
                </span>
              </li>
            ))}
            {history.map((h, i) => (
              <li key={i} data-historyrow className="flex items-center justify-between py-2 text-sm">
                <span>
                  {h.result.status === "ok" && h.result.name}
                  {h.result.status === "duplicate" && t("org.checkin.again", { name: h.result.name })}
                  {h.result.status === "invalid" && t("org.checkin.unknown")}
                  {h.result.status === "cancelled" && t("org.checkin.cancelledRsvp")}
                  {h.result.status === "expired" && t("qr.checkin.expiredItem")}
                  {h.result.status === "waitlisted" && t("qr.checkin.waitlistedItem")}
                  {(h.result.status === "forbidden" || h.result.status === "unauthorized") && t("org.checkin.errorItem")}
                </span>
                <span className="text-muted">{h.at}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
