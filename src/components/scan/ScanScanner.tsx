"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraError, startQrCamera, type QrCamera, type QrCameraMode } from "@/lib/qr-camera";
import { useT } from "@/i18n/provider";

/**
 * The poster → scan loop's reader half: point at a poster QR (the event's
 * absolute URL, see poster.ts) and land on the event. Only THIS site's
 * `/events/<id>` paths navigate — a stranger's QR gets an honest refusal,
 * not a redirect into the unknown.
 */
function eventPathFrom(text: string): string | null {
  try {
    const url = new URL(text, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const match = url.pathname.match(/^\/events\/([A-Za-z0-9_-]+)\/?$/);
    return match ? `/events/${match[1]}` : null;
  } catch {
    return null; // not even a URL
  }
}

export function ScanScanner() {
  const router = useRouter();
  const t = useT();
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<QrCameraMode | null>(null);
  const [unknown, setUnknown] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<QrCamera | null>(null);
  // One navigation, ever: the page unmounts on push, so this only guards
  // the frames between decode and route change.
  const busyRef = useRef(false);
  const lastScan = useRef({ text: "", at: 0 }); // hold-still cooldown

  function onText(text: string) {
    const now = Date.now();
    if (text === lastScan.current.text && now - lastScan.current.at < 2000) return;
    lastScan.current = { text, at: now };
    const path = eventPathFrom(text);
    if (!path) {
      setUnknown(true);
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    void cameraRef.current?.stop(); // never leave the camera running behind us
    router.push(path);
  }

  async function startScanner() {
    const container = readerRef.current;
    if (!container) return;
    setCameraError(null);
    try {
      const camera = await startQrCamera({ container, onText });
      cameraRef.current = camera;
      setCameraMode(camera.mode);
      setScanning(true);
    } catch (err) {
      console.error("Camera start failed:", err);
      setCameraError(
        err instanceof CameraError ? t("common.cameraInsecure") : t("scan.cameraError")
      );
      setScanning(false);
    }
  }

  async function stopScanner() {
    await cameraRef.current?.stop();
    cameraRef.current = null;
    setCameraMode(null);
    setScanning(false);
    setUnknown(false);
  }

  // Never leave the camera running when the component unmounts.
  useEffect(() => {
    return () => {
      void cameraRef.current?.stop();
    };
  }, []);

  return (
    <div className="card overflow-hidden" data-scancard data-scanmode={cameraMode ?? undefined}>
      <div
        ref={readerRef}
        id="scan-reader"
        className="min-h-64 bg-ink/90 [&_video]:!h-auto [&_video]:!w-full"
      />
      {!scanning ? (
        <div className="flex flex-col items-center gap-3 p-6">
          <p className="text-sm text-muted" data-cameramsg>
            {cameraError ?? t("scan.cameraHint")}
          </p>
          <button className="btn btn-primary" data-startcamera onClick={startScanner}>
            {t("scan.startCamera")}
          </button>
        </div>
      ) : (
        <div className="flex justify-center p-4">
          <button className="btn btn-secondary" data-stopcamera onClick={stopScanner}>
            {t("scan.stopCamera")}
          </button>
        </div>
      )}
      {/* An honest refusal, kept on screen — the camera keeps running so a
          second try doesn't need a restart. */}
      {unknown && (
        <p
          role="alert"
          data-unknown
          className="border-t border-line bg-[#fdecea] px-5 py-3 text-sm font-semibold text-[color:var(--color-danger)]"
        >
          {t("scan.unknown")}
        </p>
      )}
    </div>
  );
}
