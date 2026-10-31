/**
 * One camera, two decoders — the shared QR camera behind the door scanner
 * (organizer check-in) and the student /scan surface.
 *
 * Native-first: where the browser ships the Shape Detection API
 * (window.BarcodeDetector) we use it — zero bundle cost, hardware-accelerated
 * on phones, and no dynamic import at all. Everywhere else (and whenever the
 * native path fails to even start) we fall back to html5-qrcode, whose
 * ~109 kB stay out of the initial chunk behind the same dynamic import the
 * door screen always used.
 *
 * The camera is NEVER started on an insecure origin: getUserMedia is blocked
 * on plain http:// (anything but localhost), and the venue demo is often
 * opened off a LAN IP — exactly the URL where a camera silently dies. We say
 * that in words BEFORE the browser's generic permission error can.
 *
 * Both paths honour the same contract:
 *   startQrCamera({ container, onText }) → { mode, stop() }
 * `mode` is which decoder won ("native" | "legacy"); `stop()` ends every
 * track, clears the container and is idempotent. `onText` fires per decoded
 * frame — a QR held in view decodes ~10× a second, so the CALLER owns the
 * dedupe/cooldown (the door has one, the scan surface navigates once).
 */

export type QrCameraMode = "native" | "legacy";

export class CameraError extends Error {
  constructor(readonly reason: "insecure") {
    super(`qr-camera: ${reason}`);
  }
}

export type QrCamera = {
  mode: QrCameraMode;
  /** Idempotent: ends every track, kills the decode loop, clears the container. */
  stop(): Promise<void>;
};

/** The slice of the Shape Detection API we use — typed here so the build
 *  never depends on lib.dom shipping BarcodeDetector, and so probes can
 *  stub or remove window.BarcodeDetector freely. */
type NativeBarcodeDetector = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

function nativeCtor():
  | (new (opts: { formats: string[] }) => NativeBarcodeDetector)
  | undefined {
  return (
    window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => NativeBarcodeDetector;
    }
  ).BarcodeDetector;
}

export async function startQrCamera(opts: {
  /** Empty element the camera may own (legacy mode: html5-qrcode fills it,
   *  which requires the element to carry an id). */
  container: HTMLElement;
  /** Every decoded frame — the caller dedupes. */
  onText: (text: string) => void;
}): Promise<QrCamera> {
  // Read at START time, not module time: the page may have loaded on a
  // secure origin and been re-pointed, and the answer must be fresh.
  if (!window.isSecureContext) throw new CameraError("insecure");

  const Native = nativeCtor();
  if (Native && navigator.mediaDevices) {
    try {
      return await startNative(opts.container, opts.onText, Native);
    } catch {
      // Native refused to start (no device, platform gap, odd stream):
      // the legacy path gets its turn before the caller sees an error.
    }
  }
  return startLegacy(opts.container, opts.onText);
}

async function startNative(
  container: HTMLElement,
  onText: (text: string) => void,
  Native: new (opts: { formats: string[] }) => NativeBarcodeDetector
): Promise<QrCamera> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  try {
    const detector = new Native({ formats: ["qr_code"] });
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    container.replaceChildren(video);
    video.srcObject = stream;
    await video.play();

    const tick = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        if (!stopped && codes.length > 0) onText(codes[0].rawValue);
      } catch {
        // A frame the detector can't read (video still warming up) is
        // normal — the next one comes 250 ms later.
      }
      if (!stopped) timer = setTimeout(() => void tick(), 250);
    };
    void tick();

    return {
      mode: "native",
      stop: async () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        for (const track of stream.getTracks()) track.stop();
        container.replaceChildren();
      },
    };
  } catch (err) {
    // We acquired a camera we can no longer use — never leak the track.
    for (const track of stream.getTracks()) track.stop();
    throw err;
  }
}

async function startLegacy(
  container: HTMLElement,
  onText: (text: string) => void
): Promise<QrCamera> {
  if (!container.id) throw new Error("qr-camera: container needs an id");
  // ~109 kB library, loaded only when the camera is actually started.
  const { Html5Qrcode } = await import("html5-qrcode");
  const scanner = new Html5Qrcode(container.id);
  await scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 220, height: 220 } },
    onText,
    () => {} // per-frame decode failures are normal; ignore
  );
  return {
    mode: "legacy",
    stop: async () => {
      try {
        await scanner.stop(); // ends its tracks
        scanner.clear(); // empties the container
      } catch {
        // Already stopped.
      }
    },
  };
}
