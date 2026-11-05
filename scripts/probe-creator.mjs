/**
 * Creator traffic console (src/app/creator/**) E2E — the special login
 * and the dashboard behind it.
 *
 * Contract asserted here:
 *   - anonymous /creator bounces to /creator/login (route-group guard)
 *   - a wrong password shows the honest error and stays on the door
 *   - the env credentials land on the /creator dashboard (cp-creator set)
 *   - a real page view (the /events visit) is recorded by the reporter and
 *     surfaced in the dashboard's top-paths table
 *   - stat blocks render (4 figures incl. the all-time count)
 *   - /creator/login while signed in redirects to /creator
 *   - the creator session is NOT an app session: /admin still demands a
 *     NextAuth login (the two systems never leak into each other)
 *   - sign out drops the cookie; a fresh anonymous visit is bounced again
 *   - Arabic locale: dir=rtl + the AR title on the door
 *   - the collector validates beacons (javascript:, //host, missing
 *     visitorId rejected with 400; a well-formed path stored with 200)
 *   - the reporter never records /creator* paths (the console is not
 *     traffic)
 *
 * Fixture: none created — the probe's own page views are deleted in
 * cleanup (createdAt >= run start) so the creator's dashboard shows only
 * real human traffic. Requires CREATOR_LOGIN / CREATOR_PASSWORD in .env.
 * UI language: English (cp-locale=en), Arabic for the rtl check.
 * Usage: node scripts/probe-creator.mjs   (prod server on :3100)
 */
import { readFileSync } from "node:fs";
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const OUT = ".taste-skill";
const RUN_START = Date.now();

// Fail fast — without these the door renders an honest notice, and every
// login check below would be asserting against a form that is not there.
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] ??= m[2];
}
if (!process.env.CREATOR_LOGIN || !process.env.CREATOR_PASSWORD) {
  console.error(
    "probe-creator: CREATOR_LOGIN / CREATOR_PASSWORD missing from .env — set them first (see .env.example)"
  );
  process.exit(1);
}

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

// ---- Cleanup (the probe's own page views) -----------------------------
async function cleanupFixture() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const gone = await prisma.pageView.deleteMany({
      where: { createdAt: { gte: new Date(RUN_START) } },
    });
    console.log(`fixture cleaned: ${gone.count} probe page views removed`);
  } finally {
    await prisma.$disconnect();
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

/** Drop every cookie on the origin by name (same deterministic helper as
 *  probe-choose — clearBrowserCookies left a session alive once). */
async function clearSession(page) {
  const jar = await page.send("Network.getCookies", { urls: [origin] });
  for (const c of jar.cookies ?? []) {
    await page.send("Network.deleteCookies", { name: c.name, url: origin });
  }
}

const hasCookie = async (page, name) => {
  const r = await page.send("Network.getCookies", { urls: [origin] });
  return (r.cookies ?? []).some((c) => c.name === name);
};

/** Fill the creator door and submit; resolves when cp-creator appears. */
async function creatorLogin(page, login, password) {
  const ready = await waitFor(page, 'input[name="login"]');
  if (!ready) throw new Error(`no creator login form on ${await page.eval("location.href")}`);
  await fill(page, 'input[name="login"]', login);
  await fill(page, 'input[name="password"]', password);
  await submit(page);
  for (let i = 0; i < 40; i++) {
    if (await hasCookie(page, "cp-creator")) return true;
    await sleep(250);
  }
  return false;
}

const main = async () => {
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1280, height: 900 });

    await clearSession(page);
    await page.send("Network.setCookie", { name: "cp-locale", value: "en", url: origin });

    // 1 — generate traffic the honest way: render a real page and let the
    // root-layout reporter beacon it.
    await page.goto(`${origin}/events`);
    await sleep(1000);
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    let recorded = null;
    try {
      recorded = await prisma.pageView.findFirst({
        where: { path: "/events", createdAt: { gte: new Date(RUN_START) } },
      });
    } finally {
      await prisma.$disconnect();
    }
    check(
      "Reporter records a real /events view (PageView row)",
      !!recorded,
      recorded ? `visitor=${recorded.visitorId.slice(0, 8)}…` : "no row since run start"
    );

    // 2 — anonymous bounce.
    await page.goto(`${origin}/creator`);
    await waitForPath(page, "/creator/login");
    check(
      "Anonymous /creator bounces to /creator/login",
      (await pathNow(page)).startsWith("/creator/login"),
      `path=${await pathNow(page)}`
    );

    // 3 — wrong password: honest error, no navigation, no cookie.
    await waitFor(page, 'input[name="login"]');
    await fill(page, 'input[name="login"]', process.env.CREATOR_LOGIN);
    await fill(page, 'input[name="password"]', "definitely-wrong");
    await submit(page);
    const alerted = await waitFor(page, '[role="alert"]');
    const alertText = alerted ? await page.eval(`document.querySelector('[role="alert"]').textContent`) : "";
    check(
      "Wrong password shows the honest error on the door",
      alerted && alertText.includes("Wrong login or password") && !(await hasCookie(page, "cp-creator")),
      `alert="${alertText}"`
    );

    // 4 — the real credentials land on the dashboard.
    const gotIn = await creatorLogin(page, process.env.CREATOR_LOGIN, process.env.CREATOR_PASSWORD);
    const atDash = await waitForPath(page, "/creator");
    const dash = atDash
      ? await page.eval(`(() => ({
          h1: document.querySelector("h1")?.textContent.trim() ?? "",
          stats: document.querySelectorAll("dl dd").length,
        }))()`)
      : { h1: "", stats: 0 };
    check(
      "Correct credentials land on the /creator dashboard",
      gotIn && atDash && dash.h1 === "Traffic",
      `path=${await pathNow(page)} h1="${dash.h1}"`
    );
    check("Dashboard renders the four stat blocks", dash.stats === 4, `dd count=${dash.stats}`);
    await page.screenshot({ path: `${OUT}/probe-creator-dash.jpg` });

    // 5 — the recorded /events view is visible in the top-paths table.
    const bodyText = await page.eval(`document.body.innerText`);
    check(
      "Dashboard surfaces the recorded /events view",
      bodyText.includes("/events"),
      bodyText.includes("/events") ? "/events present in tables" : "missing from tables"
    );

    // 6 — the door skips itself when already signed in.
    await page.goto(`${origin}/creator/login`);
    const skipped = await waitForPath(page, "/creator");
    check(
      "/creator/login while signed in redirects to /creator",
      skipped && (await pathNow(page)) === "/creator",
      `path=${await pathNow(page)}`
    );

    // 7 — session separation: the creator cookie opens no app door.
    await page.goto(`${origin}/admin`);
    await waitForPath(page, "/login");
    check(
      "Creator session is not an app session (/admin still demands login)",
      (await pathNow(page)).startsWith("/login"),
      `path=${await pathNow(page)}`
    );

    // 8 — sign out: cookie gone, door closes.
    await page.goto(`${origin}/creator`);
    await waitFor(page, "form .btn-primary");
    await page.eval(`document.querySelector("form .btn-primary").click()`);
    const out = await waitForPath(page, "/creator/login");
    check(
      "Sign out drops the cp-creator cookie",
      out && !(await hasCookie(page, "cp-creator")),
      `path=${await pathNow(page)}`
    );

    // 9 — a fresh anonymous visit stays bounced.
    await page.goto(`${origin}/creator`);
    await waitForPath(page, "/creator/login");
    check(
      "/creator stays closed after logout (fresh anonymous visit)",
      (await pathNow(page)).startsWith("/creator/login"),
      `path=${await pathNow(page)}`
    );

    // 10 — Arabic rendering of the door.
    await page.send("Network.setCookie", { name: "cp-locale", value: "ar", url: origin });
    await page.goto(`${origin}/creator/login`);
    const ar = await page.eval(`(() => ({
      dir: document.documentElement.dir,
      h1: document.querySelector("h1")?.textContent.trim() ?? "",
    }))()`);
    check(
      "Arabic locale: rtl + AR title on the creator door",
      ar.dir === "rtl" && ar.h1 === "دخول المنشئ",
      `dir=${ar.dir} h1="${ar.h1}"`
    );
    await page.screenshot({ path: `${OUT}/probe-creator-ar.jpg` });

    // 11 — collector validation: garbage is rejected, a well-formed path
    // is stored (the stored row is removed by cleanup with the rest).
    const statuses = await page.eval(`(async () => {
      const post = (body) =>
        fetch("/api/traffic", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }).then((r) => r.status);
      return {
        js: await post({ path: "javascript:alert(1)", visitorId: "probe-visitor-0001" }),
        proto: await post({ path: "//evil.example/x", visitorId: "probe-visitor-0001" }),
        noVisitor: await post({ path: "/probe-collector-check" }),
        ok: await post({ path: "/probe-collector-check", visitorId: "probe-visitor-0001" }),
      };
    })()`);
    check(
      "Collector rejects garbage beacons and stores a well-formed one",
      statuses.js === 400 && statuses.proto === 400 && statuses.noVisitor === 400 && statuses.ok === 200,
      JSON.stringify(statuses)
    );

    // 12 — the console is not traffic: no /creator* row may ever exist.
    const prisma2 = new PrismaClient();
    let creatorRows = -1;
    try {
      creatorRows = await prisma2.pageView.count({ where: { path: { startsWith: "/creator" } } });
    } finally {
      await prisma2.$disconnect();
    }
    check(
      "Reporter never records /creator* paths (the console is not traffic)",
      creatorRows === 0,
      `rows=${creatorRows}`
    );

    await page.close();
  } finally {
    await browser.close();
    await cleanupFixture();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-creator: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
