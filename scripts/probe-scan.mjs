/**
 * Poster → scan loop (Phase 14, part 2). The generated poster now carries a
 * real QR — the event URL as vector modules on the orange rail — and the
 * student /scan surface opens that event by pointing a camera at it.
 *
 * Journey (French UI, prod server on :3100):
 *   poster SVG fetched, rasterized in-page, decoded by the native
 *     BarcodeDetector → must equal the event's absolute URL
 *   student login → /scan renders, nav carries the entry
 *   stubbed camera holding the poster's QR → lands on /events/<id>
 *   a stranger's QR → honest refusal, still on /scan, camera still running
 *   mobile /scan → no sideways scroll
 *
 * The camera stub is the same canvas-stream technique as probe-camera
 * (qrcode matrix → SVG data URL → captureStream), so decode travels the
 * real pipeline both times.
 *
 * Usage: node scripts/probe-scan.mjs   (prod server on :3100)
 */
import QRCode from "qrcode";
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const EVENT = "seed-event-line-follower";
const EVENT_URL = `${origin}/events/${EVENT}`;
const POSTER_URL = `${origin}/api/events/${EVENT}/poster`;
const OUT = ".taste-skill";
// Exact FR copy of scan.cameraHint (probes run Accept-Language=fr).
const FR_HINT = "Le QR imprimé sur une affiche ouvre directement l'événement.";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

/** The component logs the swallowed camera error; keep it for failing checks. */
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

/**
 * Decoder-independent poster proof: the ink path on the rail, parsed back
 * into a module grid, must be EXACTLY the matrix `qrcode` builds for the
 * event URL — geometry, position, no mirroring. Wrong URL, wrong ECC, a
 * clipped card or an RTL double-mirror all mismatch. A native optical
 * decode above this (where the browser has BarcodeDetector) upgrades it,
 * but this assert runs everywhere.
 */
function structuralQrMatches(svg, expectedUrl) {
  const m = svg.match(/<path d="([^"]+)" fill="#14130f"\/>/);
  if (!m) return { ok: false, why: "no ink-filled QR path in the SVG" };
  const segRe = /M(\d+) (\d+)h(\d+)v(\d+)h-(\d+)z/g;
  const runs = [];
  let mod = 0;
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  let mm;
  while ((mm = segRe.exec(m[1]))) {
    const x = +mm[1], y = +mm[2], w = +mm[3], h = +mm[4];
    if (mod === 0) mod = h;
    if (h !== mod || +mm[5] !== w) return { ok: false, why: `malformed run ${mm[0]}` };
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
    runs.push({ x, y, w, h });
  }
  if (!runs.length || mod <= 0) return { ok: false, why: "QR path has no module runs" };

  const qr = QRCode.create(expectedUrl, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const expected = (r, c) => Boolean(qr.modules.data[r * size + c]);
  if (maxX - minX !== size * mod || maxY - minY !== size * mod) {
    return {
      ok: false,
      why: `grid ${maxX - minX}×${maxY - minY} ≠ expected ${size * mod}×${size * mod} (mod=${mod})`,
    };
  }
  const covered = new Set();
  for (const { x, y, w, h } of runs) {
    if (w % mod !== 0) return { ok: false, why: `run width ${w} is not a multiple of mod=${mod}` };
    // Runs are in PIXELS (module × mod) — step whole modules.
    for (let dy = 0; dy < h; dy += mod) {
      for (let dx = 0; dx < w; dx += mod) {
        const c = (x + dx - minX) / mod;
        const r = (y + dy - minY) / mod;
        if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= size || c >= size) {
          return { ok: false, why: `cell off the ${size}×${size} grid (mod=${mod})` };
        }
        covered.add(r * size + c);
      }
    }
  }
  let darkCount = 0;
  for (let i = 0; i < size * size; i++) if (qr.modules.data[i]) darkCount++;
  if (covered.size !== darkCount) {
    return { ok: false, why: `${covered.size} drawn ≠ ${darkCount} expected dark modules` };
  }
  for (const i of covered) {
    if (!expected(Math.floor(i / size), i % size)) {
      return { ok: false, why: `extra dark at ${Math.floor(i / size)},${i % size}` };
    }
  }
  return { ok: true, why: `${darkCount} modules match the ${expectedUrl} matrix (mod=${mod})` };
}

// ---- QR frame source (probe-camera's, verbatim technique) -------------
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

// ---- House helpers ----------------------------------------------------
const has = (page, sel) => page.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
const bodyHas = (page, s) =>
  page.eval(`document.body.innerText.includes(${JSON.stringify(s)})`);
const pathOf = (page) => page.eval(`location.pathname`);

const waitFor = async (page, sel, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (await has(page, sel)) return true;
    await sleep(250);
  }
  return false;
};

const waitForPath = async (page, want, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if ((await pathOf(page)) === want) return true;
    await sleep(250);
  }
  return false;
};

const scanMode = (page) =>
  page.eval(`document.querySelector("[data-scancard]")?.dataset.scanmode ?? null`);
const cameramsg = (page) =>
  page.eval(`document.querySelector("[data-cameramsg]")?.textContent?.trim() ?? ""`);

/** Click start, retrying while the hint is still up (absorbs first clicks
 *  before hydration — house pattern). A real refusal changes the message
 *  and ends the loop instead of hammering it. Both fields come from ONE
 *  eval: a React commit between two reads can show mode-less/unmounted
 *  states that never existed. */
async function startCamera(page, hint) {
  const read = () =>
    page.eval(`({
      mode: document.querySelector("[data-scancard]")?.dataset.scanmode ?? null,
      msg: document.querySelector("[data-cameramsg]")?.textContent?.trim() ?? "",
    })`);
  for (let attempt = 0; attempt < 4; attempt++) {
    await click(page, "[data-startcamera]");
    for (let j = 0; j < 16; j++) {
      const s = await read();
      if (s.mode) return true;
      if (s.msg !== hint && s.msg !== "") return false; // honest refusal copy
      await sleep(250);
    }
  }
  return false;
}

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
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1280, height: 900 });
    const camErrors = captureCameraErrors(page);
    await login(page, "student@campus.ma");

    // 1a — the poster's QR, verified against the delivered SVG itself: the
    //      drawn module grid must be exactly the event URL's matrix.
    const posterSvg = await (await fetch(POSTER_URL)).text();
    const structural = structuralQrMatches(posterSvg, EVENT_URL);
    check(
      "Poster QR is the event URL's matrix (vector-verified)",
      structural.ok,
      structural.why
    );

    // 1b — where the browser ships an optical decoder, ALSO decode it for
    //      real; otherwise this step is honestly skipped, never faked.
    const decoded = await page.eval(`(async () => {
      if (typeof window.BarcodeDetector !== "function") return "NO_NATIVE";
      const res = await fetch(${JSON.stringify(POSTER_URL)});
      if (!res.ok) return "HTTP_" + res.status;
      const svg = await res.text();
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1200; canvas.height = 1600;
      canvas.getContext("2d").drawImage(img, 0, 0);
      const codes = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(canvas);
      return codes.length ? codes[0].rawValue : "NONE";
    })()`);
    if (decoded === "NO_NATIVE") {
      console.log("SKIP  poster QR optical decode — this Chromium has no window.BarcodeDetector");
    } else {
      check("Poster QR decodes to the event URL", decoded === EVENT_URL, `decoded=${decoded}`);
    }

    // 2 — the student surface exists where the nav promised it.
    await page.goto(`${origin}/scan`);
    const onScan = await waitFor(page, "[data-startcamera]");
    const navLink = await has(page, 'a[href="/scan"]');
    check(
      "/scan renders with the nav entry",
      onScan && navLink && (await bodyHas(page, "Scanner un QR")),
      `card=${onScan} nav=${navLink}`
    );

    // 3 — camera holds the poster's QR → the event opens.
    await installCamera(page, EVENT_URL);
    const started = await startCamera(page, FR_HINT);
    await page.screenshot({ path: `${OUT}/probe-scan-live.jpg` });
    const landed = await waitForPath(page, `/events/${EVENT}`, 60);
    const noCrash = !(await bodyHas(page, "Quelque chose a cassé"));
    check(
      "Student scan of the poster QR opens the event",
      started && landed && noCrash,
      `path=${await pathOf(page)}${started ? "" : ` cameramsg=${JSON.stringify(await cameramsg(page))}${camErrors.length ? ` raw=${JSON.stringify(camErrors.at(-1))}` : ""}`}`
    );

    // 4 — a stranger's QR: honest refusal, camera keeps running so the
    //     student can try the right poster without restarting.
    await page.goto(`${origin}/scan`);
    await waitFor(page, "[data-startcamera]");
    await installCamera(page, "https://example.org/not-ours");
    const started2 = await startCamera(page, FR_HINT);
    const mode = await scanMode(page);
    const unknownShown =
      (await waitFor(page, "[data-unknown]", 60)) &&
      (await bodyHas(page, "Ce QR n'ouvre pas un événement du site."));
    const stillHere = (await pathOf(page)) === "/scan";
    const cameraAlive = await has(page, "[data-stopcamera]");
    check(
      "Foreign QR gets an honest refusal, not a navigation",
      started2 && unknownShown && stillHere && cameraAlive && (mode === "native" || mode === "legacy"),
      `scanmode=${mode} path=${await pathOf(page)} unknown=${unknownShown} alive=${cameraAlive}${started2 ? "" : ` cameramsg=${JSON.stringify(await cameramsg(page))}${camErrors.length ? ` raw=${JSON.stringify(camErrors.at(-1))}` : ""}`}`
    );
    await page.screenshot({ path: `${OUT}/probe-scan-unknown.jpg` });
    await page.close();

    // 5 — mobile: loads, no sideways scroll.
    const mobile = await browser.newPage({ width: 390, height: 844 });
    await login(mobile, "student@campus.ma");
    await mobile.goto(`${origin}/scan`);
    const mOk = await waitFor(mobile, "[data-startcamera]");
    const overflow = await mobile.eval(
      `document.documentElement.scrollWidth - document.documentElement.clientWidth`
    );
    check(
      "Mobile /scan: loaded, no sideways scroll",
      mOk && overflow <= 0,
      `overflow=${overflow}px`
    );
    await mobile.screenshot({ path: `${OUT}/probe-scan-mobile.jpg` });
    await mobile.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-scan: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
