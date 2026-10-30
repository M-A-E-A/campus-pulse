/**
 * Clubs E2E (Phase 12): the directory, the poster profile, and the follow
 * round-trip — everything the two new routes promise, in a real browser.
 *
 *   · the directory renders every seeded club with a working search
 *     (shipped normalizeSearch module behind a 250ms debounce), the count
 *     line tracks it, and a no-match lands on the honest empty state;
 *   · a card click-through reaches the profile (monogram, stats, upcoming);
 *   · anonymous follow must NOT toggle — it redirects to /login?from=…
 *     so the visitor comes back where they were;
 *   · signed in as Salma (who already follows Club Innovation): the toggle
 *     flips aria-pressed AND the follower stat round-trips N → N-1 → N —
 *     that round-trip is what proves toggleFollowAction revalidates both
 *     the cached counts and the route (stale counts would stay at N);
 *   · cross-links: nav entry, dashboard chips, event-detail byline;
 *   · RTL (cp-locale=ar) mirrors the whole page, the OG meta + PNG exist,
 *     and a bogus id 404s instead of wearing an empty profile.
 *
 * Logins are node-side (jar → Auth.js credentials callback →
 * Network.setCookie), same as probe-pulse/probe-wallet — clicking the React
 * login form from CDP proved flaky. Search typing uses the native value
 * setter + input event (React owns the field). Screenshots land in
 * .taste-skill/ for the design scoring pass.
 *
 * Usage: node scripts/probe-clubs.mjs   (prod server on :3100)
 */
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const OUT = ".taste-skill";
const CLUB = "Club Innovation EMSI";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

/** Same hand-rolled jar as probe-pulse.mjs: csrf → credentials callback →
 *  session token, with the cookie header kept for node-side fetches. */
async function login(email) {
  const jar = new Map();
  const grab = (r) => {
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const p = c.split(";")[0];
      const i = p.indexOf("=");
      if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1));
    }
  };
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const csrfRes = await fetch(`${origin}/api/auth/csrf`);
  grab(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${origin}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
      origin,
      referer: `${origin}/login`,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password: "password123",
      callbackUrl: `${origin}/login`,
    }),
  });
  grab(res);
  const token = jar.get("authjs.session-token");
  if (!token) throw new Error(`login failed for ${email} (status ${res.status})`);
  return { token, cookie: cookieHeader() };
}

async function authedPage(browser, token) {
  const page = await browser.newPage({ width: 1280, height: 900, dsf: 1 });
  await page.send("Network.setCookie", {
    name: "authjs.session-token",
    value: token,
    url: origin,
  });
  return page;
}

/** Trusted click: scroll the target into view, aim at its center, then the
 *  mouseMoved → press → release trio React's synthetic handlers need. */
async function clickSel(page, selector) {
  const box = await page.eval((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, selector);
  if (!box) throw new Error(`no element for ${selector}`);
  await sleep(180);
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: box.x,
    y: box.y,
    button: "none",
    buttons: 0,
  });
  await page.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: box.x,
    y: box.y,
    button: "left",
    clickCount: 1,
  });
}

/** React owns the search field — the native setter + input event is what
 *  makes the framework notice the keystroke. */
async function typeInto(page, selector, text) {
  await page.eval(
    ({ sel, value }) => {
      const input = document.querySelector(sel);
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(
        input,
        value
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { sel: selector, value: text }
  );
}

const readCount = (page) =>
  page.eval(`(() => {
    const el = document.querySelector("[data-clubcount]");
    const nums = (el?.textContent ?? "").match(/\\d+/g)?.map(Number) ?? [];
    return { shown: nums[0] ?? null, total: nums[1] ?? null };
  })()`);

const readFollowers = (page) =>
  page.eval(`(() => {
    const box = document.querySelector("[data-clubstats] > div");
    return box ? Number((box.querySelector("p")?.textContent ?? "").trim()) : null;
  })()`);

const readPressed = (page) =>
  page.eval(`document.querySelector("[data-follow]")?.getAttribute("aria-pressed") ?? null`);

async function until(fn, ms = 6000, step = 250) {
  const end = Date.now() + ms;
  let v = await fn();
  while (v !== true && Date.now() < end) {
    await sleep(step);
    v = await fn();
  }
  return v === true;
}

const browser = await Browser.launch();
try {
  const student = await login("student@campus.ma");

  // ---- 1. Anonymous directory ------------------------------------------
  const anon = await browser.newPage({ width: 1280, height: 900, dsf: 1 });
  await anon.goto(`${origin}/clubs`, { timeoutMs: 30000, settleMs: 1200 });

  const cards = await anon.eval(`document.querySelectorAll("[data-clubcard]").length`);
  const hasSearch = await anon.eval(`!!document.querySelector("[data-clubsearch]")`);
  check("directory renders the seeded clubs", cards >= 3, `${cards} cards`);
  check("directory has the search input", hasSearch, `hook=${hasSearch}`);
  const count0 = await readCount(anon);
  check(
    "count line shows the full hand",
    count0.shown !== null && count0.shown === count0.total && count0.total >= 3,
    `shown=${count0.shown} total=${count0.total}`
  );
  await anon.screenshot({ path: `${OUT}/clubs-directory.png` });

  // The profile target: Club Innovation's card (its link carries the cuid —
  // club ids are generated, so the probe scrapes rather than hardcodes).
  const clubHref = await anon.eval(
    `(() => {
      const card = [...document.querySelectorAll("[data-clubcard]")]
        .find((c) => c.textContent.includes(${JSON.stringify(CLUB)}));
      return card?.querySelector("[data-clublink]")?.getAttribute("href") ?? null;
    })()`
  );
  check("a card links its profile", !!clubHref && clubHref.startsWith("/clubs/"), clubHref ?? "none");
  const clubId = clubHref ? clubHref.split("/").pop() : "";

  // ---- 2. Search: debounce → one card, nonsense → empty state, clear ----
  await typeInto(anon, "[data-clubsearch]", "innovation");
  const narrowed = await until(async () => {
    const n = await anon.eval(`document.querySelectorAll("[data-clubcard]").length`);
    return n === 1;
  });
  const onlyOne = await anon.eval(
    `document.querySelector("[data-clubcard]")?.textContent.includes(${JSON.stringify(CLUB)}) ?? false`
  );
  const count1 = await readCount(anon);
  check("search narrows to the one club", narrowed && onlyOne, `cards=1 match=${onlyOne}`);
  check("count line follows the filter", count1.shown === 1, `shown=${count1.shown}`);

  await typeInto(anon, "[data-clubsearch]", "zzqqxx-no-such-club");
  const emptyShown = await until(async () =>
    anon.eval(`!!document.querySelector("[data-clubsempty]") && document.querySelectorAll("[data-clubcard]").length === 0`)
  );
  check("no-match lands on the empty state", emptyShown, `empty=${emptyShown}`);

  await clickSel(anon, "[data-clubclear]");
  const restored = await until(async () => {
    const n = await anon.eval(`document.querySelectorAll("[data-clubcard]").length`);
    return n >= 3;
  });
  const countBack = await readCount(anon);
  check(
    "clear restores the directory",
    restored && countBack.shown === countBack.total,
    `cards=${restored} shown=${countBack.shown}/${countBack.total}`
  );

  // ---- 3. Card → profile ------------------------------------------------
  await clickSel(anon, `[data-club="${clubId}"] [data-clublink]`);
  const reachedProfile = await until(async () =>
    anon.eval(
      `location.pathname.startsWith("/clubs/") && document.querySelector("[data-clubprofile]") !== null`
    )
  );
  const h1 = await anon.eval(`document.querySelector("h1")?.textContent.trim() ?? ""`);
  check("card click reaches the profile", reachedProfile, `h1=${JSON.stringify(h1)}`);
  check("profile wears the club name", h1 === CLUB, h1);

  const statBoxes = await anon.eval(`document.querySelectorAll("[data-clubstats] > div").length`);
  check("profile prints its three counts", statBoxes === 3, `${statBoxes} stat boxes`);

  const upcoming = await anon.eval(
    `document.querySelectorAll("[data-clubevents] a").length`
  );
  const hasEventsSection = await anon.eval(
    `!!document.querySelector("[data-clubevents]") || !!document.querySelector("[data-clubeventsempty]")`
  );
  check("profile shows upcoming events", hasEventsSection && upcoming >= 1, `event cards=${upcoming}`);
  await anon.screenshot({ path: `${OUT}/clubs-profile.png` });

  // ---- 4. Anonymous follow must redirect, not toggle ---------------------
  await clickSel(anon, "[data-follow]");
  const sentToLogin = await until(async () =>
    anon.eval(
      `location.pathname === "/login" && location.search.includes("from=") && decodeURIComponent(location.search).includes("/clubs/")`
    )
  );
  check("anonymous follow sends you to login", sentToLogin, await anon.eval("location.pathname + location.search"));

  // ---- 5. Signed in: follow round-trip N → N-1 → N ----------------------
  const page = await authedPage(browser, student.token);
  await page.goto(`${origin}${clubHref}`, { timeoutMs: 30000, settleMs: 1200 });

  const initialPressed = await readPressed(page);
  const n0 = await readFollowers(page);
  check(
    "Salma starts following (seeded)",
    initialPressed === "true" && n0 !== null && n0 >= 1,
    `aria-pressed=${initialPressed} followers=${n0}`
  );

  await clickSel(page, "[data-follow]");
  const unfollowed = await until(async () => (await readPressed(page)) === "false");
  const gotDecrement = await until(async () => (await readFollowers(page)) === n0 - 1);
  const n1 = await readFollowers(page);
  check(
    "unfollow flips the button and decrements the stat",
    unfollowed && gotDecrement && n1 === n0 - 1,
    `pressed=${unfollowed} followers ${n0} → ${n1}`
  );

  await clickSel(page, "[data-follow]");
  const refollowed = await until(async () => (await readPressed(page)) === "true");
  const gotRestore = await until(async () => (await readFollowers(page)) === n0);
  const n2 = await readFollowers(page);
  check(
    "follow round-trips the stat (revalidated, not cached)",
    refollowed && gotRestore && n2 === n0,
    `pressed=${refollowed} followers ${n1} → ${n2}`
  );

  // ---- 6. Cross-links (node-side HTML) ----------------------------------
  const dash = await fetch(`${origin}/dashboard`, { headers: { cookie: student.cookie } });
  const dashHtml = await dash.text();
  check(
    "dashboard chips link the profile",
    dash.status === 200 && /href="\/clubs\/[A-Za-z0-9_-]+"/.test(dashHtml),
    `status=${dash.status}`
  );

  const nav = await (await fetch(`${origin}/events`)).text();
  check("nav carries the Clubs entry", nav.includes('href="/clubs"'), "desktop nav link served");

  const ev = await (await fetch(`${origin}/events/seed-event-line-follower`)).text();
  check("event byline links the club", /href="\/clubs\/[A-Za-z0-9_-]+"/.test(ev), "club name is a link");

  const prof = await (await fetch(`${origin}${clubHref}`)).text();
  check("profile ships og:image meta", prof.includes('property="og:image"'), "og:image tag present");

  const ogRes = await fetch(`${origin}${clubHref}/opengraph-image`);
  const ogBuf = Buffer.from(await ogRes.arrayBuffer());
  check(
    "club OG serves a real PNG",
    ogRes.status === 200 && (ogRes.headers.get("content-type") ?? "").includes("image/png") && ogBuf.length > 10240,
    `status=${ogRes.status} type=${ogRes.headers.get("content-type")} bytes=${ogBuf.length}`
  );

  const bogus = await fetch(`${origin}/clubs/not-a-club-999`);
  check("bogus club id 404s", bogus.status === 404, `status=${bogus.status}`);

  // ---- 7. RTL + mobile --------------------------------------------------
  await page.send("Network.setCookie", { name: "cp-locale", value: "ar", url: origin });
  const rtl = await browser.newPage({ width: 1280, height: 900, dsf: 1 });
  await rtl.goto(`${origin}/clubs`, { timeoutMs: 30000, settleMs: 1200 });
  const isRtl = await rtl.eval(`document.documentElement.dir === "rtl"`);
  const rtlCards = await rtl.eval(`document.querySelectorAll("[data-clubcard]").length`);
  check("Arabic locale mirrors the directory", isRtl && rtlCards >= 3, `dir=${isRtl} cards=${rtlCards}`);
  await rtl.screenshot({ path: `${OUT}/clubs-directory-ar.png` });
  await rtl.close();

  const mobile = await browser.newPage({ width: 390, height: 844, dsf: 2 });
  await mobile.goto(`${origin}/clubs`, { timeoutMs: 30000, settleMs: 1200 });
  const overflow = await mobile.eval(
    `document.documentElement.scrollWidth - document.documentElement.clientWidth`
  );
  check("mobile directory has no sideways scroll", overflow <= 0, `overflow=${overflow}px`);
  await mobile.screenshot({ path: `${OUT}/clubs-directory-mobile.png` });
  await mobile.close();

  await page.close();
  await anon.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\nTOTAL: ${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
