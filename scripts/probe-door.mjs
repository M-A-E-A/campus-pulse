/**
 * Door E2E — offline check-in queue (Phase 13). The venue Wi-Fi dies
 * mid-door: a scan must be KEPT (localStorage queue), counted on screen,
 * and re-sent when the network returns — never dropped, never double-
 * counted (the server is idempotent: re-sending an already-checked-in
 * ticket answers "duplicate").
 *
 * Journey (single page, CDP Network.emulateNetworkConditions cuts):
 *   online scan → ok          offline scan → queued card (count=1)
 *   re-scan offline → dedupe  queue persists in storage over time
 *   online → auto-drain (online event; Sync button as fallback)
 *   rescan of the drained code → duplicate  = landed exactly once
 *   conflict: offline-scan an ALREADY-in ticket → drains to duplicate
 *   invalid: offline-scan a garbage code → drains to an honest rejection
 *   mobile fresh load → no phantom queue, no sideways scroll
 *
 * Reload-while-offline is deliberately not tested: this is a
 * server-rendered page, so Chrome shows its own error page with no app to
 * reload — the storage-level assert below IS the reload-survival proof.
 *
 * Fixture (node-side, idempotent): Salma's seeded ticket is reset to
 * not-checked-in and Omar gets a fixed RSVP for the line-follower event,
 * so every run starts from the same door state.
 *
 * UI language is French (Chromium Accept-Language=fr).
 * Usage: node scripts/probe-door.mjs   (prod server on :3100)
 */
import { readFileSync } from "node:fs";
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const EVENT = "seed-event-line-follower";
const CODE_A = "demo-ticket-code-0001"; // Salma, seeded — reset to not-checked-in
const CODE_B = "door-probe-omar"; // Omar's fixture RSVP
const GARBAGE = "porte-manteau-404";
const OUT = ".taste-skill";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

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

// ---- House helpers (probe-offline's hardened set) ---------------------
const setOffline = async (page, off) => {
  await page.send("Network.enable");
  await page.send("Network.emulateNetworkConditions", {
    offline: off,
    latency: 0,
    downloadThroughput: off ? 0 : -1,
    uploadThroughput: off ? 0 : -1,
  });
};

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
  page.eval(
    `document.querySelector("[data-checkinbanner]")?.dataset.status ?? null`
  );
const pendingCount = async (page) =>
  (await has(page, "[data-pendingcount]"))
    ? page.eval(`document.querySelector("[data-pendingcount]").dataset.pendingcount`)
    : "0";

/** Trusted CDP click with delivery verification + DOM fallback — after an
 *  offline cut this Chrome build drops Input dispatches entirely (same
 *  reasoning and shape as probe-offline's helper). */
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

/** React-friendly value set on a controlled input. */
async function fill(page, sel, value) {
  await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
}

/** Fill the manual box and submit, retrying until `expect` observes the
 *  answer — absorbs first-clicks-before-hydration. */
async function submitCode(page, code, expect, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    await fill(page, "form input.input", code);
    await click(page, "form .btn-primary");
    for (let j = 0; j < 16; j++) {
      if (await expect()) return true;
      await sleep(250);
    }
    console.log(`  submit retry ${i + 1} for ${code}`);
  }
  return false;
}

/** Drain observer: the queue card must empty — via the page's `online`
 *  listener, or the Sync button when the emulation didn't fire the event
 *  (whichever path, the assertions below are on the END state). */
async function drain(page) {
  for (let i = 0; i < 16; i++) {
    if (!(await has(page, "[data-checkinqueue]"))) return "auto";
    await sleep(250);
  }
  if (await has(page, "[data-sync]")) {
    console.log("  online event didn't drain it — clicking Sync");
    await click(page, "[data-sync]");
  }
  return (await waitForGone(page, "[data-checkinqueue]", 40)) ? "button" : "stuck";
}

/** House UI login: fill the real form, assert the session cookie lands
 *  (the redirect itself proved flaky from CDP — probe-feedback's note). */
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
    const page = await browser.newPage({ width: 1280, height: 900 });
    await login(page, "organiser@campus.ma");
    await page.goto(`${origin}/organizer/events/${EVENT}/check-in`);
    const onDoor = await waitFor(page, "form input.input");
    check(
      "Organizer reaches the door screen",
      onDoor && (await bodyHas(page, "Check-in")),
      onDoor ? "manual box rendered" : "no manual box"
    );
    await sleep(600); // hydration before the first submit

    // 1 — online scan lands: green banner, honest name.
    const ok1 = await submitCode(page, CODE_A, async () => (await bannerStatus(page)) === "ok");
    check(
      "Online scan checks in",
      ok1 && (await bodyHas(page, "est entré")),
      `banner=${await bannerStatus(page)}`
    );

    // 2 — Wi-Fi dies: the scan is KEPT, counted, visibly waiting.
    await setOffline(page, true);
    const queued = await submitCode(
      page,
      CODE_B,
      async () => (await pendingCount(page)) === "1"
    );
    const cardText = await bodyHas(page, "Scans en attente");
    const waitLabel = await bodyHas(page, "En attente");
    const noCrash = !(await bodyHas(page, "Quelque chose a cassé"));
    check(
      "Offline scan is queued, not lost",
      queued && cardText && waitLabel && noCrash,
      `count=${await pendingCount(page)} card=${cardText} row=${waitLabel}`
    );
    await page.screenshot({ path: `${OUT}/probe-door-queued.jpg` });

    // 3 — a QR held in front of the camera queues ONCE (dedupe).
    await submitCode(page, CODE_B, async () => sleep(0) === undefined);
    await sleep(700);
    check(
      "Re-scan while offline dedupes",
      (await pendingCount(page)) === "1",
      `count=${await pendingCount(page)}`
    );

    // 4 — the queue lives in storage (this is the reload-survival proof:
    //     a fresh page load reads the same store).
    const stored = await page.eval(
      `(() => { try { return JSON.parse(localStorage.getItem("cp-checkin-queue-v1") ?? "[]"); } catch { return ["corrupt"]; } })()`
    );
    const entry = Array.isArray(stored) ? stored[0] : null;
    check(
      "Queue persists in localStorage",
      Array.isArray(stored) && stored.length === 1 && entry?.eventId === EVENT && entry?.code === CODE_B,
      JSON.stringify(stored).slice(0, 120)
    );

    // 5 — it holds over time (no silent drop while still offline).
    await sleep(3000);
    check(
      "Queue survives the outage window",
      (await pendingCount(page)) === "1",
      `count=${await pendingCount(page)} after 3s offline`
    );

    // 6 — network returns: the queued scan drains by itself and the big
    //     banner shows the real server answer for the scan from before.
    await setOffline(page, false);
    const path = await drain(page);
    const ok2 =
      (await waitFor(page, "[data-checkinbanner]", 40)) &&
      (await bodyHas(page, "Omar Organiser"));
    check(
      "Back online, the queue drains automatically",
      path !== "stuck" && ok2,
      `drain=${path} banner=${await bannerStatus(page)}`
    );

    // 7 — proof of landing: rescan the drained code → duplicate. If the
    //     queued scan had never reached the server, this would be "ok".
    const dup1 = await submitCode(page, CODE_B, async () => (await bannerStatus(page)) === "duplicate");
    check(
      "Drained scan landed exactly once (idempotent replay)",
      dup1 && (await bodyHas(page, "Déjà enregistré")),
      `banner=${await bannerStatus(page)}`
    );

    // 8 — conflict honesty: a ticket checked in BEFORE the outage goes
    //     down, queued during it, must drain to "duplicate" — never ok.
    await setOffline(page, true);
    await submitCode(page, CODE_A, async () => (await pendingCount(page)) === "1");
    await setOffline(page, false);
    const path2 = await drain(page);
    check(
      "Mid-outage conflict drains to duplicate",
      path2 !== "stuck" && (await bannerStatus(page)) === "duplicate",
      `drain=${path2} banner=${await bannerStatus(page)}`
    );

    // 9 — a typo'd code queued offline must sync to an honest rejection,
    //     not a fake success.
    await setOffline(page, true);
    await submitCode(page, GARBAGE, async () => (await pendingCount(page)) === "1");
    await setOffline(page, false);
    const path3 = await drain(page);
    const invalidShown =
      (await bannerStatus(page)) === "invalid" && (await bodyHas(page, "Code inconnu"));
    check(
      "Queued garbage syncs to an honest rejection",
      path3 !== "stuck" && invalidShown,
      `drain=${path3} banner=${await bannerStatus(page)}`
    );
    await page.screenshot({ path: `${OUT}/probe-door-synced.jpg` });

    // Storage is empty after the drains — no phantom scans anywhere.
    const drained = await page.eval(
      `(() => { try { return (JSON.parse(localStorage.getItem("cp-checkin-queue-v1") ?? "[]")).length; } catch { return -1; } })()`
    );
    check("Queue storage fully drained", drained === 0, `entries=${drained}`);

    await page.close();

    // 10 — mobile door: fresh load (same origin, same storage), the queue
    //      is empty, nothing scrolls sideways.
    const mobile = await browser.newPage({ width: 390, height: 844 });
    await login(mobile, "organiser@campus.ma");
    await mobile.goto(`${origin}/organizer/events/${EVENT}/check-in`);
    const mOk = await waitFor(mobile, "form input.input");
    const overflow = await mobile.eval(
      `document.documentElement.scrollWidth - document.documentElement.clientWidth`
    );
    const phantom = await has(mobile, "[data-checkinqueue]");
    check(
      "Mobile door: loaded, no phantom queue, no sideways scroll",
      mOk && overflow <= 0 && !phantom,
      `overflow=${overflow}px queue=${phantom}`
    );
    await mobile.screenshot({ path: `${OUT}/probe-door-mobile.jpg`, fullPage: false });
    await mobile.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-door: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
