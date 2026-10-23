"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { checkInAction, type CheckInResult } from "@/lib/actions/checkin";
import { useT } from "@/i18n/provider";

type ScanOutcome = {
  result: CheckInResult;
  at: string;
};

/**
 * Door screen. Camera scanner on top, manual code entry underneath
 * (cameras fail on http:// and in some browsers — the manual box is the
 * fallback that saves the demo).
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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false); // ignore frames while one is in flight
  const t = useT();

  // Latest outcome drives the big banner (green/red).
  const latest = history[0];

  async function submitCode(raw: string) {
    const code = raw.trim();
    if (!code || busyRef.current) return;
    busyRef.current = true;
    const result = await checkInAction(eventId, code);
    setHistory((h) => [
      { result, at: new Date().toLocaleTimeString() },
      ...h.slice(0, 19),
    ]);
    busyRef.current = false;
  }

  async function startScanner() {
    setCameraError(null);
    try {
      // ~109 kB library, loaded only when the camera is actually started.
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          if (!busyRef.current) void submitCode(text);
        },
        () => {} // per-frame decode failures are normal; ignore
      );
      setScanning(true);
    } catch {
      setCameraError(
        t("org.checkin.cameraError")
      );
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // Already stopped.
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }

  // Never leave the camera running when the component unmounts.
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
      }
    };
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <a href="/organizer" className="text-sm text-muted hover:text-ink">{t("org.back")}</a>
      <h1 className="mt-2 text-3xl font-bold">{t("org.checkin.header")}</h1>
      <p className="mt-1 text-muted">{t("org.checkin.sub", { title: eventTitle })}</p>

      {/* Result banner */}
      {latest && (
        <div
          role="status"
          className={`mt-6 rounded-xl px-5 py-4 font-semibold ${
            latest.result.status === "ok"
              ? "bg-[#e6f4ea] text-[color:var(--color-success)]"
              : latest.result.status === "duplicate" || latest.result.status === "expired" || latest.result.status === "waitlisted"
                ? "bg-[#fff3cd] text-[#8a6d00]"
                : "bg-[#fdecea] text-[color:var(--color-danger)]"
          }`}
        >
          {latest.result.status === "ok" && t("org.checkin.ok", { name: latest.result.name })}
          {latest.result.status === "duplicate" && t("org.checkin.duplicate", { name: latest.result.name })}
          {latest.result.status === "waitlisted" && t("qr.checkin.waitlisted", { name: latest.result.name })}
          {latest.result.status === "invalid" && t("org.checkin.invalid")}
          {latest.result.status === "cancelled" && t("org.checkin.cancelled")}
          {latest.result.status === "expired" && t("qr.checkin.expired")}
          {latest.result.status === "forbidden" && t("org.checkin.forbidden")}
          {latest.result.status === "unauthorized" && t("org.checkin.unauthorized")}
        </div>
      )}

      {/* Camera */}
      <div className="card mt-6 overflow-hidden">
        <div id="qr-reader" className="min-h-64 bg-ink/90 [&_video]:!h-auto [&_video]:!w-full" />
        {!scanning && (
          <div className="flex flex-col items-center gap-3 p-6">
            <p className="text-sm text-muted">
              {cameraError ?? t("org.checkin.cameraHint")}
            </p>
            <button className="btn btn-primary" onClick={startScanner}>
              {t("org.checkin.startCamera")}
            </button>
          </div>
        )}
        {scanning && (
          <div className="flex justify-center p-4">
            <button className="btn btn-secondary" onClick={stopScanner}>{t("org.checkin.stopCamera")}</button>
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

      {/* Recent scans */}
      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{t("org.checkin.recent")}</h2>
          <ul className="mt-2 divide-y divide-line">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
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
