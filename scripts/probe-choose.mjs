/**
 * Post-login choice page (src/app/choose/page.tsx) E2E — the student /
 * organizer crossroads every non-admin sign-in lands on.
 *
 * Contract asserted here:
 *   - anonymous /choose bounces to /login?from=%2Fchoose
 *   - registration lands on /choose (the register redirect)
 *   - /choose asks the question in French with both cards present
 *   - the organizer card PROMOTES a fresh student end to end: session
 *     role, DB role, audit row — and the regression this probe exists
 *     for: edge middleware (which reads only the JWT) must let the freshly
 *     promoted user into /organizer instead of bouncing them to
 *     /dashboard, i.e. the session really was re-issued
 *   - the promoted user's no-club console renders its honest state
 *   - the student card routes any role to /dashboard
 *   - Arabic: dir=rtl + the AR title
 *   - admins skip /choose entirely (sign-in lands on /admin)
 *   - existing organizers see /choose on every login, and the organizer
 *     card routes them without a second promotion
 *   - a `from` return trip (anonymous at /dashboard) still bypasses /choose
 *
 * Fixture: one throwaway account per run, created through the real
 * register form (so the register landing is covered), deleted with its
 * audit rows in cleanup so smoke counts stay pristine.
 *
 * UI language is French (Chromium Accept-Language=fr).
 * Usage: node scripts/probe-choose.mjs   (prod server on :3100)
 */
import { readFileSync } from "node:fs";
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const OUT = ".taste-skill";
const PROBE_EMAIL = `choose-probe-${Date.now()}@campus.ma`;
const ORGANISER = "organiser@campus.ma";
const ADMIN = "admin@campus.ma";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

// ---- Cleanup (audit rows + the throwaway user) ------------------------
let prisma = null;
async function prismaClient() {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)="?(.*?)"?$/);
    if (m) process.env[m[1]] ??= m[2];
  }
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();
  return prisma;
}

async function cleanupFixture() {
  const p = await prismaClient();
  try {
    await p.auditLog.deleteMany({
      where: { action: "user.self_promoted_organizer", targetLabel: PROBE_EMAIL },
    });
    await p.user.deleteMany({ where: { email: PROBE_EMAIL } });
    console.log("fixture cleaned: probe user + audit rows removed");
  } finally {
    await p.$disconnect();
  }
}

// ---- House helpers ----------------------------------------------------
const pathNow = (page) => page.eval(`location.pathname + location.search`);

const waitForPath = async (page, want, tries = 48) => {
  for (let i = 0; i < tries; i++) {
    const p = await page.eval(`location.pathname`);
    if (p === want) return true;
    await sleep(250);
  }
  return false;
};

const fill = (page, sel, value) =>
  page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);

const submit = (page) => page.eval(`document.querySelector("form .btn-primary")?.click()`);

const waitFor = async (page, sel, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (await page.eval(`!!document.querySelector(${JSON.stringify(sel)})`)) return true;
    await sleep(250);
  }
  return false;
};

/** Drop every cookie on the origin by name — deterministic, unlike
 *  clearBrowserCookies, which left the session alive once and made
 *  /dashboard render authed (the from trip never happened). */
async function clearSession(page) {
  const jar = await page.send("Network.getCookies", { urls: [origin] });
  for (const c of jar.cookies ?? []) {
    await page.send("Network.deleteCookies", { name: c.name, url: origin });
  }
}

/** Fill + submit the form currently on screen (no navigation, no clear). */
async function fillAndSubmit(page, email) {
  const ready = await waitFor(page, 'input[name="email"]');
  if (!ready) throw new Error(`no login form on ${await page.eval("location.href")}`);
  await fill(page, 'input[name="email"]', email);
  await fill(page, 'input[name="password"]', "password123");
  await submit(page);
  let cookie = false;
  for (let i = 0; i < 40; i++) {
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

/** Full sign-in: fresh jar first, so each identity is really the new one. */
async function login(page, email) {
  await clearSession(page);
  await page.goto(`${origin}/login`);
  await fillAndSubmit(page, email);
}

const sessionRole = (page) =>
  page.eval(`fetch("/api/auth/session").then((r) => r.json()).then((s) => s?.user?.role ?? null)`);

const main = async () => {
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1280, height: 900 });

    // 1 — anonymous bounce carries the return trip.
    await page.goto(`${origin}/choose`);
    await waitForPath(page, "/login");
    const anon = await pathNow(page);
    check(
      "Anonymous /choose bounces to /login with from=/choose",
      anon.startsWith("/login") && decodeURIComponent(anon).includes("/choose"),
      `path=${anon}`
    );

    // 2 — a fresh registration lands on the choice page (register redirect).
    await page.goto(`${origin}/register`);
    await fill(page, 'input[name="name"]', "Choose Probe");
    await fill(page, 'input[name="email"]', PROBE_EMAIL);
    await fill(page, 'input[name="password"]', "password123");
    await submit(page);
    const landed = await waitForPath(page, "/choose");
    check(
      "Registration lands on /choose",
      landed,
      `path=${await pathNow(page)}`
    );

    // 3 — the question, both cards, French copy.
    const intro = await page.eval(`(() => ({
      h1: document.querySelector("h1")?.textContent.trim() ?? "",
      h2s: [...document.querySelectorAll("h2")].map((el) => el.textContent.trim()),
      student: !!document.querySelector('[data-choose="student"]'),
      organizer: !!document.querySelector('[data-choose="organizer"]'),
    }))()`);
    check(
      "/choose asks the question with both cards (FR)",
      intro.h1 === "Étudiant ou organisateur ?" &&
        intro.h2s.includes("Étudiant") &&
        intro.h2s.includes("Organisateur") &&
        intro.student &&
        intro.organizer,
      `h1="${intro.h1}" h2s=${JSON.stringify(intro.h2s)}`
    );
    await page.screenshot({ path: `${OUT}/probe-choose-fr.jpg` });

    // 4 — THE regression: promote, then enter /organizer on the fresh JWT.
    await page.eval(`document.querySelector('[data-choose="organizer"]').click()`);
    const promoted = await waitForPath(page, "/organizer");
    check(
      "Organizer card lands a fresh student on /organizer (not bounced to /dashboard)",
      promoted,
      `path=${await pathNow(page)}`
    );
    const role = await sessionRole(page);
    check("Session role refreshed to ORGANIZER", role === "ORGANIZER", `role=${role}`);

    // 5 — honest no-club console for the new organizer. The state arrives
    // with the RSC payload — poll for it instead of racing first paint
    // (a single read flaked once while smoke was loading the server).
    let consoleText = "";
    for (let i = 0; i < 40; i++) {
      consoleText = await page.eval(`document.body.innerText`);
      if (consoleText.includes("Vous n'êtes encore membre d'aucun club")) break;
      await sleep(250);
    }
    check(
      "Promoted organizer sees the honest no-club state",
      consoleText.includes("Vous n'êtes encore membre d'aucun club"),
      consoleText.includes("Vous n'êtes encore membre d'aucun club") ? "copy present" : "missing"
    );

    // 6 — DB role + audit row (self-promotion is recorded).
    await sleep(400);
    const p = await prismaClient();
    let dbRole = null;
    let audit = null;
    try {
      const user = await p.user.findUnique({ where: { email: PROBE_EMAIL } });
      dbRole = user?.role ?? null;
      audit = await p.auditLog.findFirst({
        where: { action: "user.self_promoted_organizer", targetLabel: PROBE_EMAIL },
      });
    } finally {
      await p.$disconnect();
    }
    check("DB role promoted to ORGANIZER", dbRole === "ORGANIZER", `role=${dbRole}`);
    check(
      "Audit row records the self-promotion (via choose)",
      !!audit && (audit.meta ?? "").includes("choose"),
      audit ? `meta=${audit.meta}` : "no row"
    );

    // 7 — the student card routes (any role may open the student home).
    await page.goto(`${origin}/choose`);
    await page.eval(`document.querySelector('[data-choose="student"]').click()`);
    const toDashboard = await waitForPath(page, "/dashboard");
    check(
      "Student card routes to /dashboard",
      toDashboard,
      `path=${await pathNow(page)}`
    );

    // 8 — Arabic rendering of the same page.
    await page.send("Network.setCookie", { name: "cp-locale", value: "ar", url: origin });
    await page.goto(`${origin}/choose`);
    const ar = await page.eval(`(() => ({
      dir: document.documentElement.dir,
      h1: document.querySelector("h1")?.textContent.trim() ?? "",
    }))()`);
    check(
      "Arabic locale: rtl + AR title",
      ar.dir === "rtl" && ar.h1 === "طالب أم منظم فعاليات؟",
      `dir=${ar.dir} h1="${ar.h1}"`
    );
    await page.screenshot({ path: `${OUT}/probe-choose-ar.jpg` });

    // 9 — admins skip the page entirely.
    await login(page, ADMIN);
    const adminPath = await waitForPath(page, "/admin");
    check(
      "Admin sign-in skips /choose (lands on /admin)",
      adminPath && (await pathNow(page)).startsWith("/admin"),
      `path=${await pathNow(page)}`
    );

    // 10 — every login asks: an existing organizer sees /choose, and the
    // organizer card routes them without touching the role again.
    await login(page, ORGANISER);
    const orgLanded = await waitForPath(page, "/choose");
    check(
      "Existing organizer sees /choose on every login",
      orgLanded,
      `path=${await pathNow(page)}`
    );
    await page.eval(`document.querySelector('[data-choose="organizer"]').click()`);
    const orgRouted = await waitForPath(page, "/organizer");
    check(
      "Organizer card routes an existing organizer to /organizer",
      orgRouted,
      `path=${await pathNow(page)}`
    );

    // 11 — the from return trip still wins over the choice page.
    await clearSession(page);
    await page.goto(`${origin}/dashboard`);
    const atLogin = await waitForPath(page, "/login");
    if (atLogin) await fillAndSubmit(page, ORGANISER);
    const backHome = await waitForPath(page, "/dashboard");
    check(
      "from=/dashboard return trip bypasses /choose",
      atLogin && backHome && (await pathNow(page)).startsWith("/dashboard"),
      `path=${await pathNow(page)} atLogin=${atLogin}`
    );

    await page.close();
  } finally {
    await browser.close();
    await cleanupFixture();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-choose: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
