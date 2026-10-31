/**
 * "Who's going" E2E (quick win 5) — the social-proof chapter on the event
 * detail page: 12 first-name tiles + dashed overflow + the count line.
 *
 * Contract asserted here:
 *   - CONFIRMED RSVPs only (a WAITLISTED seat is not a going person)
 *   - upcoming events only (an ended event has the post-event band; a
 *     zero-going event shows nothing — no sad empty chapter)
 *   - the line names the first two by RSVP date, with correct FR plurals
 *   - Arabic flips the line AND the heading (fresh browser → header locale)
 *   - the block is public: an anonymous visitor and a signed-in student
 *     see the same disclosure (no auth-conditional hiding)
 *   - mobile 390: present, no sideways scroll
 *
 * Fixture (node-side, idempotent, self-cleaning): two probe-owned events —
 * one with 14 confirmed + 1 waitlisted RSVPs (staggered dates), one with
 * none. The seeded 3-RSVP event is used for the three-name line. Cleanup
 * deletes the probe events + users so smoke counts stay pristine.
 *
 * UI language is French (Chromium Accept-Language=fr).
 * Usage: node scripts/probe-going.mjs   (prod server on :3100)
 */
import { readFileSync } from "node:fs";
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const EVENT = "seed-event-line-follower"; // seeded, 3 CONFIRMED
const PAST = "seed-past-futsal"; // ended event
const PROBE_EVENT = "going-probe-event";
const PROBE_EMPTY = "going-probe-empty";
const OUT = ".taste-skill";

const NAMES = [
  "Yassine Bennani",
  "Nadia Bennis",
  "Karim Tazi",
  "Salma Idrissi",
  "Hamza Alaoui",
  "Imane Cherkaoui",
  "Otman Berrada",
  "Loubna El Fassi",
  "Reda Skalli",
  "Meryem Ouali",
  "Anas Sbai",
  "Sara Lahlou",
  "Ayoub Mnif",
  "Kenza Amrani",
];
const WAITLISTED_NAME = "Zakaria Nonshown";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

const first = (full) => full.trim().split(/\s+/)[0];

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

async function setupFixture() {
  const p = await prismaClient();
  try {
    const club = await p.club.findFirst({ select: { id: true } });
    const category = await p.category.findFirst({ select: { id: true } });
    if (!club || !category) throw new Error("seed data missing — run prisma db seed");

    const base = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    for (const [id, extra] of [
      [PROBE_EVENT, { title: "Who-going probe event" }],
      [PROBE_EMPTY, { title: "Who-going probe empty event" }],
    ]) {
      await p.event.upsert({
        where: { id },
        update: { status: "PUBLISHED", startsAt: base, endsAt: new Date(base.getTime() + 3 * 3600 * 1000) },
        create: {
          id,
          title: extra.title,
          description: "Probe fixture.",
          location: "Salle C101",
          startsAt: base,
          endsAt: new Date(base.getTime() + 3 * 3600 * 1000),
          status: "PUBLISHED",
          clubId: club.id,
          categoryId: category.id,
        },
      });
    }

    // 14 confirmed with staggered dates → deterministic "first two", plus
    // one waitlisted rider that must never appear in the going list.
    const roster = [...NAMES.map((n, i) => [n, i, "CONFIRMED"]), [WAITLISTED_NAME, 99, "WAITLISTED"]];
    for (const [name, i, status] of roster) {
      const user = await p.user.upsert({
        where: { email: `going-probe-${i}@campus.ma` },
        update: { name },
        create: { name, email: `going-probe-${i}@campus.ma`, passwordHash: "x", role: "STUDENT" },
      });
      const at = new Date(base.getTime() - (60 - i) * 60 * 1000);
      await p.rsvp.upsert({
        where: { userId_eventId: { userId: user.id, eventId: PROBE_EVENT } },
        update: { status, createdAt: at },
        create: {
          userId: user.id,
          eventId: PROBE_EVENT,
          status,
          ticketCode: `going-probe-code-${String(i).padStart(2, "0")}`,
          createdAt: at,
        },
      });
    }
    console.log(`fixture ready: ${PROBE_EVENT} (14 confirmed + 1 waitlisted), ${PROBE_EMPTY}`);
  } finally {
    await p.$disconnect();
  }
}

async function cleanupFixture() {
  const p = await prismaClient();
  try {
    await p.event.deleteMany({ where: { id: { in: [PROBE_EVENT, PROBE_EMPTY] } } });
    await p.user.deleteMany({ where: { email: { startsWith: "going-probe-" } } });
    console.log("fixture cleaned: probe events + users removed");
  } finally {
    await p.$disconnect();
  }
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

/** One atomic read of the whole block (React/SSR settles between evals). */
const goingState = (page) =>
  page.eval(`(() => {
    const s = document.querySelector("[data-going]");
    if (!s) return null;
    const stack = s.querySelector("[data-going-stack]");
    const tiles = stack ? [...stack.children].map((el) => ({
      text: el.textContent.trim(),
      dashed: el.className.includes("border-dashed"),
    })) : [];
    return {
      count: s.dataset.goingCount,
      heading: s.querySelector("h2")?.textContent.trim() ?? "",
      line: s.querySelector("h2 + div + p, [data-going-stack] + p")?.textContent.trim() ?? "",
      tiles,
      sectionText: s.textContent,
    };
  })()`);

async function login(page, email) {
  await page.goto(`${origin}/login`);
  const fill = async (sel, value) =>
    page.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
  await fill('input[name="email"]', email);
  await fill('input[name="password"]', "password123");
  await page.eval(`document.querySelector("form .btn-primary")?.click()`);
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
  await setupFixture();
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1280, height: 900 });

    // 1–3 — the probe event: block, count, 12 tiles + overflow, exact FR line.
    await page.goto(`${origin}/events/${PROBE_EVENT}`);
    await waitFor(page, "[data-going]");
    const st = await goingState(page);
    const letters = NAMES.map((n) => first(n).charAt(0).toUpperCase());
    const overflowTile = st?.tiles.find((t) => t.dashed);
    check(
      "Block renders with the real confirmed count",
      st !== null && st.count === "14",
      `count=${st?.count}`
    );
    check(
      "12 letter tiles + dashed overflow (+2), letters match first names",
      st?.tiles.length === 13 &&
        overflowTile?.text === "+2" &&
        st.tiles.slice(0, 12).every((t, i) => t.text === letters[i] && !t.dashed),
      `tiles=${st?.tiles.length} overflow=${overflowTile?.text}`
    );
    check(
      "FR line names the first two + 12 others (exact copy)",
      st?.heading === "Qui y va ?" &&
        (st?.line ?? "").includes(`${first(NAMES[0])}, ${first(NAMES[1])} et 12 autres y vont`),
      `line="${st?.line}"`
    );
    await page.eval(
      `document.querySelector("[data-going]").scrollIntoView({ block: "center" })`
    );
    await sleep(400);
    await page.screenshot({ path: `${OUT}/probe-going-desktop.jpg` });

    // 4 — a waitlisted seat is not a going person.
    check(
      "Waitlisted rider never appears",
      !(st?.sectionText ?? "").includes(WAITLISTED_NAME),
      `absent=${!(st?.sectionText ?? "").includes(WAITLISTED_NAME)}`
    );

    // 5 — the seeded 3-RSVP event: three tiles, no overflow, three-name line.
    await page.goto(`${origin}/events/${EVENT}`);
    await waitFor(page, "[data-going]");
    const seeded = await goingState(page);
    const p2 = await (async () => {
      const { PrismaClient } = await import("@prisma/client");
      const c = new PrismaClient();
      const rows = await c.rsvp.findMany({
        where: { eventId: EVENT, status: "CONFIRMED" },
        orderBy: { createdAt: "asc" },
        select: { user: { select: { name: true } } },
      });
      await c.$disconnect();
      return rows.map((r) => first(r.user.name));
    })();
    check(
      "Seeded event: 3 tiles, no overflow, exact three-name line",
      seeded?.count === "3" &&
        seeded.tiles.length === 3 &&
        !seeded.tiles.some((t) => t.dashed) &&
        (seeded.line ?? "").includes(`${p2[0]}, ${p2[1]} et ${p2[2]} y vont`),
      `count=${seeded?.count} tiles=${seeded?.tiles.length} line="${seeded?.line}"`
    );

    // 6–7 — an ended event and a zero-going event show no chapter at all.
    await page.goto(`${origin}/events/${PAST}`);
    await sleep(900);
    const goneEnded = !(await has(page, "[data-going]"));
    await page.goto(`${origin}/events/${PROBE_EMPTY}`);
    await sleep(900);
    const goneEmpty = !(await has(page, "[data-going]"));
    check(
      "Ended event: no going chapter (post-event band owns it)",
      goneEnded,
      `absent=${goneEnded}`
    );
    check(
      "Zero-going event: no empty chapter",
      goneEmpty,
      `absent=${goneEmpty}`
    );

    // 8 — Arabic: fresh context → Accept-Language header flips heading + line.
    const ar = await browser.newPage({ width: 1280, height: 900 });
    await ar.send("Network.enable");
    await ar.send("Network.setExtraHTTPHeaders", { headers: { "Accept-Language": "ar" } });
    await ar.goto(`${origin}/events/${PROBE_EVENT}`);
    await waitFor(ar, "[data-going]");
    const arSt = await goingState(ar);
    check(
      "Arabic flips heading and line (RTL copy)",
      arSt?.heading === "من سيحضر؟" &&
        (arSt?.line ?? "").includes(
          `${first(NAMES[0])} و${first(NAMES[1])} و12 آخرون سيحضرون`
        ),
      `heading="${arSt?.heading}" line="${arSt?.line}"`
    );
    await ar.eval(`document.querySelector("[data-going]").scrollIntoView({ block: "center" })`);
    await sleep(400);
    await ar.screenshot({ path: `${OUT}/probe-going-ar.jpg` });
    await ar.close();

    // 9 — mobile 390: present, no sideways scroll.
    const mobile = await browser.newPage({ width: 390, height: 844 });
    await mobile.goto(`${origin}/events/${PROBE_EVENT}`);
    const mOk = await waitFor(mobile, "[data-going]");
    const overflow = await mobile.eval(
      `document.documentElement.scrollWidth - document.documentElement.clientWidth`
    );
    check(
      "Mobile 390: block present, no sideways scroll",
      mOk && overflow <= 0,
      `overflow=${overflow}px`
    );
    await mobile.eval(
      `document.querySelector("[data-going]").scrollIntoView({ block: "center" })`
    );
    await sleep(400);
    await mobile.screenshot({ path: `${OUT}/probe-going-mobile.jpg` });
    await mobile.close();

    // 10 — a signed-in student sees the same public disclosure.
    await login(page, "student@campus.ma");
    await page.goto(`${origin}/events/${PROBE_EVENT}`);
    const signedIn = await waitFor(page, "[data-going]");
    const st2 = await goingState(page);
    check(
      "Signed-in student sees the same block (no auth-conditional hiding)",
      signedIn && st2?.count === "14" && st2?.line === st?.line,
      `count=${st2?.count}`
    );
    await page.close();
  } finally {
    await browser.close();
    await cleanupFixture();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-going: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
