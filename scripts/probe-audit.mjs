/**
 * Phase 15 E2E — rate limiting + the audit trail.
 *
 * Contract asserted here:
 *   - 8 failed logins with a throwaway email → the 9th attempt is refused
 *     with the honest FR lockout copy, not the wrong-password copy
 *   - the lockout is keyed PER EMAIL: Salma's correct login still lands
 *     immediately after the brute-force lockout (campus-NAT-safe keying)
 *   - the lockout writes exactly ONE `auth.rate_limited` audit row — not
 *     one per spammed request
 *   - a real RSVP writes an `rsvp.created` row naming the actor + event
 *   - /admin/audit is admin-only: BOTH the anonymous visitor and a
 *     signed-in student bounce to /
 *   - the audit page translates: rows show FR labels, never raw
 *     `admin.audit.action.*` keys
 *
 * The brute email is UNIQUE per run on purpose: the limiter is in-memory,
 * so a re-run inside the 10-minute window with a fixed email would start
 * pre-locked and correctly produce no second lockout row — the unique key
 * keeps every run a full 9-attempt verification. Fixture + rows self-clean
 * so smoke counts stay pristine.
 *
 * UI language is French (Chromium Accept-Language=fr).
 * Usage: node scripts/probe-audit.mjs   (prod server on :3100)
 */
import { readFileSync } from "node:fs";
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const PROBE_EVENT = "audit-probe-event";
const PROBE_TITLE = "Audit probe event";
const BRUTE = `audit-brute-${Date.now()}@nope.ma`;
const OUT = ".taste-skill";

const WRONG = "E-mail ou mot de passe invalide.";
const LOCKED = "Trop de tentatives. Réessayez dans quelques minutes.";
const JOINED = "C'est confirmé — votre billet QR est juste en dessous.";
const FR_RsvpLabel = "Inscription enregistrée";
const FR_LockLabel = "Connexion verrouillée (trop de tentatives)";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

// ---- Fixture + cleanup -------------------------------------------------
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

/** Same deletes as cleanup, so an aborted previous run starts clean. */
async function scrub() {
  const p = await prismaClient();
  try {
    await p.event.deleteMany({ where: { id: PROBE_EVENT } });
    await p.auditLog.deleteMany({
      where: {
        OR: [{ targetId: PROBE_EVENT }, { targetId: { startsWith: "audit-brute-" } }],
      },
    });
  } finally {
    await p.$disconnect();
  }
}

async function setupFixture() {
  await scrub();
  const p = await prismaClient();
  try {
    const club = await p.club.findFirst({ select: { id: true } });
    const category = await p.category.findFirst({ select: { id: true } });
    if (!club || !category) throw new Error("seed data missing — run prisma db seed");
    const base = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await p.event.create({
      data: {
        id: PROBE_EVENT,
        title: PROBE_TITLE,
        description: "Probe fixture.",
        location: "Salle C101",
        startsAt: base,
        endsAt: new Date(base.getTime() + 3 * 3600 * 1000),
        status: "PUBLISHED",
        clubId: club.id,
        categoryId: category.id,
      },
    });
    console.log(`fixture ready: ${PROBE_EVENT}, brute=${BRUTE}`);
  } finally {
    await p.$disconnect();
  }
}

async function cleanupFixture() {
  await scrub();
  console.log("fixture cleaned: probe event + audit rows removed");
}

// ---- House helpers -----------------------------------------------------
const has = (page, sel) => page.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
const waitFor = async (page, sel, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (await has(page, sel)) return true;
    await sleep(250);
  }
  return false;
};

const fillInput = (page, sel, value) =>
  page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) throw new Error("no element: " + ${JSON.stringify(sel)});
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);

/** Full-speed successful login (waits for the session cookie).
 *  Clears the jar FIRST: a leftover session cookie would satisfy the
 *  cookie wait before the new sign-in even completes — the probe logs in
 *  as several identities and each must be REAL, not the previous one. */
async function login(page, email) {
  await page.send("Network.clearBrowserCookies");
  await page.goto(`${origin}/login`);
  await fillInput(page, 'input[name="email"]', email);
  await fillInput(page, 'input[name="password"]', "password123");
  await page.eval(`document.querySelector("form .btn-primary")?.click()`);
  for (let i = 0; i < 32; i++) {
    const r = await page.send("Network.getCookies", { urls: [origin] });
    const names = (r.cookies ?? []).map((c) => c.name);
    if (names.includes("authjs.session-token") || names.includes("__Host-next-auth.session-token")) {
      return true;
    }
    await sleep(250);
  }
  throw new Error(`login failed for ${email}`);
}

/**
 * One login attempt, waiting out the REAL round trip before reading the
 * alert: the submit button's label swaps to the pending copy while the
 * server action runs and swaps back when React re-renders — so the error
 * slot can never be mistaken for the previous attempt's text.
 */
async function submitLogin(page, email, password) {
  const btnSel = "form .btn-primary";
  await fillInput(page, 'input[name="email"]', email);
  await fillInput(page, 'input[name="password"]', password);
  const label = () => page.eval(`document.querySelector(${JSON.stringify(btnSel)})?.textContent ?? ""`);
  const idle = await label();
  await page.eval(`document.querySelector(${JSON.stringify(btnSel)}).click()`);
  for (let i = 0; i < 120; i++) {
    if ((await label()) !== idle) break; // pending seen
    await sleep(40);
  }
  for (let i = 0; i < 120; i++) {
    if ((await label()) === idle) break; // round trip done
    await sleep(40);
  }
  await sleep(120);
  let alert = await page.eval(`document.querySelector('p[role="alert"]')?.textContent ?? ""`);
  if (!alert) {
    // Click didn't land at all (paint race) — one honest retry, never more.
    await page.eval(`document.querySelector(${JSON.stringify(btnSel)}).click()`);
    for (let i = 0; i < 120; i++) {
      if ((await label()) === idle) break;
      await sleep(40);
    }
    await sleep(200);
    alert = await page.eval(`document.querySelector('p[role="alert"]')?.textContent ?? ""`);
  }
  return alert;
}

const main = async () => {
  await setupFixture();
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1280, height: 900 });

    // 1–2 — brute force: 8 honest failures, then the lock, per email.
    await page.goto(`${origin}/login`);
    await waitFor(page, 'input[name="email"]');
    const alerts = [];
    for (let i = 1; i <= 9; i++) {
      alerts.push(await submitLogin(page, BRUTE, "wrong-password-x"));
    }
    check(
      "Attempts 1–8 show the wrong-password copy",
      alerts.slice(0, 8).every((a) => a === WRONG),
      `distinct=${[...new Set(alerts.slice(0, 8))].map((s) => `"${s}"`).join(",")}`
    );
    check(
      "Attempt 9 hits the lock: honest lockout copy, not wrong-password",
      alerts[8] === LOCKED,
      `alert="${alerts[8]}"`
    );
    await page.screenshot({ path: `${OUT}/probe-audit-lockout.jpg` });

    // 3 — keying is per EMAIL: the locked brute force never touches Salma.
    let salmaIn = true;
    try {
      await login(page, "student@campus.ma");
    } catch {
      salmaIn = false;
    }
    check(
      "Lockout is per-email: Salma's correct login still lands",
      salmaIn,
      `salmaIn=${salmaIn}`
    );

    // 4 — a real RSVP, through the real button, on the probe event.
    await page.goto(`${origin}/events/${PROBE_EVENT}`);
    await waitFor(page, "aside button.btn-primary");
    await page.eval(`document.querySelector("aside button.btn-primary").click()`);
    let rsvpMsg = "";
    for (let i = 0; i < 40 && !rsvpMsg; i++) {
      rsvpMsg = await page.eval(`document.querySelector('p[role="status"]')?.textContent ?? ""`);
      if (!rsvpMsg) await sleep(250);
    }
    check(
      "RSVP succeeds with the FR confirmation copy",
      rsvpMsg === JOINED,
      `msg="${rsvpMsg}"`
    );

    // 5 — a signed-in student still bounces off the admin audit page.
    await page.goto(`${origin}/admin/audit`);
    await sleep(700);
    const stuPath = await page.eval(`location.pathname`);
    check("Signed-in student bounces off /admin/audit", stuPath === "/", `path=${stuPath}`);

    // 6 — the admin sees both rows, translated, with a working nav entry.
    await login(page, "admin@campus.ma");
    await page.goto(`${origin}/admin/audit`);
    await waitFor(page, "[data-auditrow]");
    const state = await page.eval(`(() => {
      const rows = [...document.querySelectorAll("[data-auditrow]")].map((r) => ({
        action: r.dataset.auditAction,
        text: r.textContent,
      }));
      // What a READER sees: text nodes outside <script>/<style>. (Raw
      // body.textContent would include the inline i18n payload, which
      // legitimately contains every dict key ever defined.)
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let visible = "";
      while (walk.nextNode()) {
        const p = walk.currentNode.parentElement;
        if (p && !["SCRIPT", "STYLE"].includes(p.tagName)) visible += walk.currentNode.nodeValue;
      }
      return {
        rows,
        rawLeak: visible.includes("admin.audit.action."),
        nav: !!document.querySelector('a[href="/admin/audit"]'),
      };
    })()`);
    const rsvpRow = state.rows.find(
      (r) =>
        r.action === "rsvp.created" &&
        r.text.includes(PROBE_TITLE) &&
        r.text.includes("Salma") &&
        r.text.includes(FR_RsvpLabel)
    );
    const lockRow = state.rows.find(
      (r) =>
        r.action === "auth.rate_limited" &&
        r.text.includes(BRUTE) &&
        r.text.includes(FR_LockLabel)
    );
    check(
      "rsvp.created row: actor + event title + FR label",
      !!rsvpRow,
      `found=${!!rsvpRow}`
    );
    check(
      "auth.rate_limited row: brute email + FR label",
      !!lockRow,
      `found=${!!lockRow}`
    );
    check(
      "Actions are translated — no raw admin.audit.action.* keys",
      !state.rawLeak,
      `rawLeak=${state.rawLeak}`
    );
    check("Audit entry present in the admin nav", state.nav, `nav=${state.nav}`);
    await page.eval(`window.scrollTo(0, 0)`);
    await sleep(300);
    await page.screenshot({ path: `${OUT}/probe-audit-admin.jpg` });

    // 7 — exactly ONE lockout row per window, verified at the source.
    const p = await prismaClient();
    let lockRows = -1;
    try {
      lockRows = await p.auditLog.count({ where: { targetType: "auth", targetId: BRUTE } });
    } finally {
      await p.$disconnect();
    }
    check(
      "Exactly ONE auth.rate_limited row for the whole lockout",
      lockRows === 1,
      `rows=${lockRows}`
    );

    // 8 — an anonymous visitor bounces too: the middleware gate sends them
    //     to /login (the page-level guard only ever sees signed-in users,
    //     and bounces THOSE to / — asserted for the student in step 5).
    const anon = await browser.newPage({ width: 1280, height: 900 });
    await anon.send("Network.clearBrowserCookies");
    await anon.goto(`${origin}/admin/audit`);
    await sleep(700);
    const anonPath = await anon.eval(`location.pathname`);
    check("Anonymous visitor bounces off /admin/audit (to /login)", anonPath === "/login", `path=${anonPath}`);
    await anon.close();

    await page.close();
  } finally {
    await browser.close();
    await cleanupFixture();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-audit: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
