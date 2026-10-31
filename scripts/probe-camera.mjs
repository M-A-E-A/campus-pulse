/**
 * Camera E2E — the door scanner's camera path (Phase 14). Until this probe
 * every probe drove the MANUAL box; the start → getUserMedia → decode →
 * submit pipeline had zero coverage, and it is the one path that dies
 * silently when the venue demo is opened off a LAN IP.
 *
 * The camera is a STUB: navigator.mediaDevices.getUserMedia is replaced
 * with a canvas.captureStream playing REAL QR frames (built in node from
 * the same qrcode matrix the tickets use), so the page's actual decoder —
 * the native BarcodeDetector, or html5-qrcode when the probe strips it —
 * chews on genuine frames and the scan travels the real
 * onText → cooldown → checkInAction → banner pipeline.
 *
 * Journey (French UI, prod server on :3100):
 *   insecure origin (isSecureContext=false) → honest copy, no camera
 *   start → data-scanmode native|legacy → scan checks in (banner ok)
 *   same QR held in view → ONE history row (camera cooldown, no spam)
 *   stop → every track ended, viewfinder cleared
 *   second page (BarcodeDetector removed pre-document) → legacy decodes
 *
 * Fixture (node-side, idempotent): Salma's seeded ticket reset to
 * not-checked-in and Omar given the fixed RSVP — the same door state
 * probe-door resets, so the two probes run in any order.
 *
 * Usage: node scripts/probe-camera.mjs   (prod server on :3100)
 */
import { readFileSync } from "node:fs";
import QRCode from "qrcode";
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const EVENT = "seed-event-line-follower";
const CODE_A = "demo-ticket-code-0001"; // Salma, seeded — reset to not-checked-in
const CODE_B = "door-probe-omar"; // Omar's fixture RSVP
const OUT = ".taste-skill";
// Exact FR copy of common.cameraInsecure (probes run Accept-Language=fr).
const FR_INSECURE = "Caméra indisponible : la page doit être ouverte en HTTPS ou sur localhost.";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

/** The component logs the swallowed camera error (console.error); keep the
 *  last one so a failing check carries the REAL reason, not just the copy. */
function captureCameraErrors(page) {
  const logs = [];
  page.browser.on(page.sessionId, "Runtime.consoleAPICalled", (p) => {
    const txt = (p.args ?? [])
      .map((a) => a.value ?? a.description ?? "")
      .join(" ")
      .trim();
    if (txt.includes("Camera start failed")) logs.push(txt.slice(0, 400));
  });
  return logs;
}

// ---- Fixture: deterministic door state, run after run -----------------
async function resetDoorState() {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)="?(.*?)"?$/);
    if (m) process.env[m[1]] ??= m[2];
  }
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const salma = await prisma.user.findUnique({
      where: { email: "student@campus.ma" },
      select: { id: true },
    });
    const omar = await prisma.user.findUnique({
      where: { email: "organiser@campus.ma" },
      select: { id: true },
    });
    if (!salma || !omar) throw new Error("demo users missing — run prisma db seed");

    await prisma.rsvp.updateMany({
      where: { userId: salma.id, eventId: EVENT },
      data: { checkedInAt: null },
    });
    await prisma.rsvp.upsert({
      where: { userId_eventId: { userId: omar.id, eventId: EVENT } },
      update: { status: "CONFIRMED", ticketCode: CODE_B, checkedInAt: null },
      create: {
        userId: omar.id,
        eventId: EVENT,
        status: "CONFIRMED",
        ticketCode: CODE_B,
      },
    });
    console.log("fixture ready: door state reset (Salma unchecked, Omar queued-able)");
  } finally {
    await prisma.$disconnect();
  }
}

// ---- QR frame source --------------------------------------------------
/** The ticket QR as an SVG data URL — qrcode's Node canvas renderer needs
 *  the optional `canvas` package, the pure matrix + a drawn SVG does not. */
function qrDataUrl(text) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const scale = 6;
  const quiet = 4;
  const px = (size + quiet * 2) * scale;
  let rects = "";
  for (let y = 0; y < size; y++) {
    let run = 0;
    for (let x = 0; x <= size; x++) {
      const dark = x < size && Boolean(data[y * size + x]);
      if (dark) run += 1;
      else if (run > 0) {
        rects += `<rect x="${(quiet + x - run) * scale}" y="${(quiet + y) * scale}" width="${run * scale}" height="${scale}"/>`;
        run = 0;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"><rect width="${px}" height="${px}" fill="#ffffff"/><g fill="#14130f">${rects}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Replace getUserMedia with a canvas stream drawing the given QR at the
 *  viewfinder's centre — small enough to sit inside html5-qrcode's 220px
 *  qrbox crop, big enough for the native detector. */
async function installCamera(page, text) {
  await page.eval(`(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(qrDataUrl(text))};
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 800; canvas.height = 600;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 800, 600);
      ctx.drawImage(img, 305, 205, 190, 190);
    };
    draw();
    setInterval(draw, 40);
    const stream = canvas.captureStream(24);
    window.__stubTracks = stream.getTracks();
    navigator.mediaDevices.getUserMedia = async () => stream;
    return true;
  })()`);
}

// ---- House helpers (probe-offline's hardened set) ---------------------
const has = (page, sel) => page.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
const bodyHas = (page, s) =>
  page.eval(`document.body.innerText.includes(${JSON.stringify(s)})`);

const waitFor = async (page, sel, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (await has(page, sel)) return true;
    await sleep(250);
  }
  return false;
};

const waitForGone = async (page, sel, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (!(await has(page, sel))) return true;
    await sleep(250);
  }
  return false;
};

const bannerStatus = (page) =>
  page.eval(`document.querySelector("[data-checkinbanner]")?.dataset.status ?? null`);
const scanMode = (page) =>
  page.eval(`document.querySelector("[data-scancard]")?.dataset.scanmode ?? null`);
const historyRows = (page) =>
  page.eval(`document.querySelectorAll("[data-historyrow]").length`);
const tracksEnded = (page) =>
  page.eval(
    `(window.__stubTracks ?? []).length > 0 && window.__stubTracks.every((t) => t.readyState === "ended")`
  );

/** Trusted CDP click with delivery verification + DOM fallback. */
async function click(page, sel) {
  const found = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    return true;
  })()`);
  if (!found) throw new Error(`click target missing: ${sel}`);
  await sleep(350);
  const box = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (!box) throw new Error(`click target vanished: ${sel}`);
  await page.eval(`(() => {
    window.__clickDelivered = false;
    document.addEventListener("click", () => { window.__clickDelivered = true; }, { once: true, capture: true });
    return true;
  })()`);
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, buttons: 0 });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1, buttons: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1, buttons: 0 });
  let delivered = false;
  for (let i = 0; i < 6 && !delivered; i++) {
    delivered = await page.eval(`window.__clickDelivered`);
    if (!delivered) await sleep(150);
  }
  if (!delivered) {
    console.log(`  trusted click dropped — DOM click fallback for ${sel}`);
    await page.eval(`(() => {
      document.querySelector(${JSON.stringify(sel)})?.click();
      return true;
    })()`);
  }
}

async function fill(page, sel, value) {
  await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
}

/** House UI login: fill the real form, assert the session cookie lands. */
async function login(page, email) {
  await page.goto(`${origin}/login`);
  await fill(page, 'input[name="email"]', email);
  await fill(page, 'input[name="password"]', "password123");
  await click(page, "form .btn-primary");
  let cookie = false;
  for (let i = 0; i < 32; i++) {
    const r = await page.send("Network.getCookies", { urls: [origin] });
    const names = (r.cookies ?? []).map((c) => c.name);
    if (names.includes("authjs.session-token") || names.includes("__Host-next-auth.session-token")) {
      cookie = true;
      break;
    }
    await sleep(250);
  }
  if (!cookie) throw new Error(`login failed for ${email}`);
}

const main = async () => {
  await resetDoorState();
  const browser = await Browser.launch();
  try {
    // ---- Page A — the default decoder path (native when Chromium has it)
    const page = await browser.newPage({ width: 1280, height: 900 });
    const camErrors = captureCameraErrors(page);
    await login(page, "organiser@campus.ma");
    await page.goto(`${origin}/organizer/events/${EVENT}/check-in`);
    const onDoor = await waitFor(page, "form input.input");
    check(
      "Organizer reaches the door screen",
      onDoor && (await bodyHas(page, "Check-in")),
      onDoor ? "manual box rendered" : "no manual box"
    );

    // 1 — insecure origin: the camera must refuse in WORDS before
    //     getUserMedia ever runs (the LAN-IP demo case).
    await page.eval(`(() => {
      Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
      return true;
    })()`);
    await click(page, "[data-startcamera]");
    await sleep(600);
    const msg = await page.eval(
      `document.querySelector("[data-cameramsg]")?.textContent?.trim() ?? ""`
    );
    const noMode = (await scanMode(page)) === null;
    const noVideo = !(await has(page, "[data-scancard] video"));
    check(
      "Insecure origin is refused with honest copy",
      msg === FR_INSECURE && noMode && noVideo,
      `msg=${JSON.stringify(msg)} scanmode=${await scanMode(page)} video=${!noVideo}`
    );
    // Undo the sabotage EXPLICITLY: this Chromium keeps isSecureContext as
    // an OWN window property, and a bare delete leaves it undefined/false
    // (no prototype fallback to restore the true answer for us).
    await page.eval(`(() => {
      Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
      return true;
    })()`);

    // 2 — real frames through the real decoder.
    await installCamera(page, CODE_A);
    const hasNative = await page.eval(`typeof window.BarcodeDetector === "function"`);
    await click(page, "[data-startcamera]");
    const started = await waitFor(page, "[data-scancard][data-scanmode]", 60);
    const mode = await scanMode(page);
    const startMsg = await page.eval(
      `document.querySelector("[data-cameramsg]")?.textContent?.trim() ?? ""`
    );
    check(
      "Camera starts in a decoder mode",
      started && (mode === "native" || mode === "legacy"),
      `data-scanmode=${mode}${started ? "" : ` cameramsg=${JSON.stringify(startMsg)}${camErrors.length ? ` raw=${JSON.stringify(camErrors.at(-1))}` : ""}`}`
    );
    if (hasNative) {
      check("Native BarcodeDetector path used", mode === "native", `data-scanmode=${mode}`);
    } else {
      console.log("SKIP  native path — this Chromium has no window.BarcodeDetector (legacy covered)");
    }

    const ok =
      (await waitFor(page, "[data-checkinbanner]", 60)) &&
      (await bannerStatus(page)) === "ok" &&
      (await bodyHas(page, "est entré"));
    check(
      "Camera scan checks in (decode → submit → banner)",
      ok,
      `banner=${await bannerStatus(page)}`
    );
    await page.screenshot({ path: `${OUT}/probe-camera-door.jpg` });

    // 3 — the same QR held in view must NOT flood the history: without the
    //     cooldown a duplicate row lands ~0.5s after the first response.
    await sleep(1000);
    const rows = await historyRows(page);
    check("Same QR held in view submits once (cooldown)", rows === 1, `history rows=${rows}`);

    // 4 — stop: tracks die, viewfinder clears, the button comes back.
    const tracksLiveBefore = !(await tracksEnded(page));
    if (await has(page, "[data-stopcamera]")) {
      await click(page, "[data-stopcamera]");
    }
    const stopped = await waitForGone(page, "[data-scancard][data-scanmode]");
    const ended = await tracksEnded(page);
    const videoGone = !(await has(page, "[data-scancard] video"));
    const buttonBack = await has(page, "[data-startcamera]");
    check(
      "Stop ends every track and clears the viewfinder",
      tracksLiveBefore && stopped && ended && videoGone && buttonBack,
      `tracksEnded=${ended} videoGone=${videoGone}`
    );
    await page.close();

    // ---- Page B — the legacy path, forced by removing BarcodeDetector
    //      before any document script runs. A pure `delete` only: html5-
    //      qrcode's own isSupported checks `"BarcodeDetector" in window`,
    //      so a lying `{ value: undefined }` shim breaks IT too.
    const legacy = await browser.newPage({ width: 1280, height: 900 });
    const legacyErrors = captureCameraErrors(legacy);
    await legacy.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { delete window.BarcodeDetector; } catch {}`,
    });
    await login(legacy, "organiser@campus.ma");
    await legacy.goto(`${origin}/organizer/events/${EVENT}/check-in`);
    await waitFor(legacy, "form input.input");
    const stripWorks = !(await legacy.eval(`"BarcodeDetector" in window`));
    if (!stripWorks) {
      console.log("SKIP  forced-legacy page — this Chromium can't hide window.BarcodeDetector");
    } else {
      await installCamera(legacy, CODE_B);
      await click(legacy, "[data-startcamera]");
      const legacyStarted = await waitFor(legacy, "[data-scancard][data-scanmode]", 60);
      const legacyMode = await scanMode(legacy);
      const legacyOk =
        (await waitFor(legacy, "[data-checkinbanner]", 60)) &&
        (await bannerStatus(legacy)) === "ok" &&
        (await bodyHas(legacy, "Omar Organiser"));
      check(
        "Legacy fallback decodes via html5-qrcode",
        legacyStarted && legacyMode === "legacy" && legacyOk,
        `data-scanmode=${legacyMode} banner=${await bannerStatus(legacy)}${legacyStarted ? "" : ` raw=${JSON.stringify(legacyErrors.at(-1) ?? null)}`}`
      );
      if (await has(legacy, "[data-stopcamera]")) {
        await click(legacy, "[data-stopcamera]");
        await waitForGone(legacy, "[data-scancard][data-scanmode]");
        check("Legacy stop ends the stubbed tracks too", await tracksEnded(legacy), "tracksEnded");
      } else {
        check("Legacy stop ends the stubbed tracks too", false, "scanner never started");
      }
    }
    await legacy.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-camera: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
