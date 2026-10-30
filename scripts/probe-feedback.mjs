/**
 * Post-event loop E2E (Phase 7): the thank-you screen, the "would you
 * attend again?" answer, and the recommendations it feeds — driven through
 * the real UI so every check is the shipped path, not a re-implementation.
 *
 * The journey converges from ANY stored state: it makes sure the soldering
 * workshop is answered "yes", screenshots the question via "change my
 * answer", flips it to "no" (recommendations must empty), flips back to
 * "yes" (they must return), then proves the sharp edges: the club's next
 * event must be suggested while the event the student already holds a
 * ticket for must NOT be; a no-show gets the honest "thanks for signing
 * up"; live and anonymous views show no band at all.
 *
 * UI language is French here (Chromium Accept-Language=fr); assertions lean
 * on data-post hooks for structure and the FR copy for wording. The probes
 * never pass arguments to page.eval as strings — cdp.mjs only inlines the
 * arg on the FUNCTION branch, so plain string expressions only (or real
 * functions), never a function-shaped string.
 *
 * Usage: node scripts/probe-feedback.mjs   (prod server on :3100)
 */
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const SOLDER = "seed-past-soldering"; // attended, Club Innovation (3 upcoming)
const ERCPREP = "seed-past-erc-prep"; // no-show, same club — the honest greeting
const FUTURE = "seed-event-line-follower"; // live + own ticket — no band allowed
const OUT = ".taste-skill";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

/** Same hand-rolled jar as scripts/probe-pulse.mjs: csrf → credentials
 *  callback → session token. Node-side: clicking the React login form from
 *  CDP proved flaky (the POST fires, the redirect never lands). */
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
  await page.send("Network.setCookie", { name: "authjs.session-token", value: token, url: origin });
  return page;
}

const has = (page, sel) => page.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
const text = (page, sel) =>
  page.eval(`(document.querySelector(${JSON.stringify(sel)})?.innerText ?? "")`);

const waitFor = async (page, sel, tries = 30) => {
  for (let i = 0; i < tries; i++) {
    if (await has(page, sel)) return true;
    await sleep(200);
  }
  return false;
};

/** Trusted CDP click — the same path that proved reliable on the door form. */
async function click(page, sel) {
  const box = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (!box) throw new Error(`click target missing: ${sel}`);
  await sleep(150); // let the scroll settle before aiming
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
}

/** Drive the band to "answered yes" from any state; true iff a next-up
 *  pick is showing. */
async function ensureYes(page) {
  if (await has(page, '[data-post="next"]')) return true;
  if (!(await has(page, '[data-post="yes"]'))) {
    await click(page, '[data-post="change"]');
    if (!(await waitFor(page, '[data-post="yes"]'))) return false;
  }
  await click(page, '[data-post="yes"]');
  if (!(await waitFor(page, '[data-post="answered"]'))) return false;
  return has(page, '[data-post="next"]');
}

/** Drive the band to "answered no" from any state; true once settled. */
async function ensureNo(page) {
  if (await has(page, '[data-post="next"]')) {
    await click(page, '[data-post="change"]');
    if (!(await waitFor(page, '[data-post="no"]'))) return false;
  }
  if (await has(page, '[data-post="no"]')) {
    await click(page, '[data-post="no"]');
    return waitFor(page, '[data-post="answered"]');
  }
  return has(page, '[data-post="answered"]'); // already answered no
}

const browser = await Browser.launch();
try {
  const student = await login("student@campus.ma");

  // Anonymous FIRST — the session cookie must not exist in the jar yet.
  const anon = await browser.newPage({ width: 1280, height: 900, dsf: 1 });
  await anon.goto(`${origin}/events/${SOLDER}`, { timeoutMs: 30000, settleMs: 1200 });
  const anonBand = await has(anon, '[data-post="thanks"]');
  check("anonymous visitors see no band", !anonBand, `band=${anonBand}`);
  await anon.close();

  const page = await authedPage(browser, student.token);

  // 1–2. Ended + attended: the band renders, with the honest greeting.
  await page.goto(`${origin}/events/${SOLDER}`, { timeoutMs: 30000, settleMs: 1200 });
  const band = await has(page, '[data-post="thanks"]');
  check("band renders on an ended attended event", band, `band=${band}`);
  const greet = await text(page, '[data-post="thanks"]');
  check(
    "attended greeting is the honest one",
    greet.includes("Merci pour votre présence."),
    JSON.stringify(greet.split("\n")[0] ?? "")
  );

  // 3–4. Converge to "yes": the answered state must point at the club's
  //      next event, and that pick must skip what is already ticketed.
  const yesOk = await ensureYes(page);
  check("a yes answers in place and points ahead", yesOk, `answered-with-next=${yesOk}`);
  const next1 = await text(page, '[data-post="next"]');
  check(
    "the pick skips what is already ticketed",
    next1.includes("ETH 2026") && !next1.includes("Atelier robotique"),
    JSON.stringify(next1.replace(/\s+/g, " ").slice(0, 72))
  );

  // 5. "Change my answer" reopens the question — screenshot the screen.
  await click(page, '[data-post="change"]');
  const reopened = await waitFor(page, '[data-post="yes"]');
  check("change my answer reopens the question", reopened, `question-visible=${reopened}`);
  await page.screenshot({ path: `${OUT}/feedback-question.jpg`, quality: 88 });

  // 6. Answer "no": settled, and no recommendation may show.
  await click(page, '[data-post="no"]');
  const settledNo = await waitFor(page, '[data-post="answered"]');
  const nextAfterNo = await has(page, '[data-post="next"]');
  check(
    "answering no closes the question without a pick",
    settledNo && !nextAfterNo,
    `answered=${settledNo} next=${nextAfterNo}`
  );

  // 7. With nothing liked, the dashboard's recs section must say so.
  await page.goto(`${origin}/dashboard`, { timeoutMs: 30000, settleMs: 1200 });
  const recsEmpty = await text(page, '[data-post="recs"]');
  check(
    "recommendations go empty while nothing is liked",
    recsEmpty.includes("après un événement terminé") && !recsEmpty.includes("ETH 2026"),
    JSON.stringify(recsEmpty.replace(/\s+/g, " ").slice(0, 72))
  );

  // 8. Back to "yes": the pick returns; screenshot the answered screen.
  await page.goto(`${origin}/events/${SOLDER}`, { timeoutMs: 30000, settleMs: 1200 });
  const yesBack = await ensureYes(page);
  check("answering yes brings the pick back", yesBack, `answered-with-next=${yesBack}`);
  await page.screenshot({ path: `${OUT}/feedback-answered.jpg`, quality: 88 });

  // 9–10. The dashboard now lists the club's new events — minus the one
  //       the student is already booked on.
  await page.goto(`${origin}/dashboard`, { timeoutMs: 30000, settleMs: 1200 });
  const recs = await text(page, '[data-post="recs"]');
  check(
    "dashboard lists the club's next events",
    recs.includes("ETH 2026") && recs.includes("EMSI Robotic Competition"),
    JSON.stringify(recs.replace(/\s+/g, " ").slice(0, 72))
  );
  check(
    "ticketed events stay out of recommendations",
    !recs.includes("Atelier robotique"),
    `excluded=${!recs.includes("Atelier robotique")}`
  );
  await page.screenshot({ path: `${OUT}/feedback-dashboard.jpg`, quality: 88 });

  // 11–12. The no-show path: honest greeting, and a "no" never recommends.
  await page.goto(`${origin}/events/${ERCPREP}`, { timeoutMs: 30000, settleMs: 1200 });
  const noShowGreet = await text(page, '[data-post="thanks"]');
  check(
    "a no-show is greeted for signing up",
    noShowGreet.includes("Merci pour votre inscription."),
    JSON.stringify(noShowGreet.split("\n")[0] ?? "")
  );
  const noOk = await ensureNo(page);
  const noShowNext = await has(page, '[data-post="next"]');
  check(
    "a no never surfaces the club's next event",
    noOk && !noShowNext,
    `settled=${noOk} next=${noShowNext}`
  );

  // 13. A live event shows no post-event band at all.
  await page.goto(`${origin}/events/${FUTURE}`, { timeoutMs: 30000, settleMs: 1200 });
  const liveBand = await has(page, '[data-post="thanks"]');
  check("a live event shows no band", !liveBand, `band=${liveBand}`);

  await page.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\nTOTAL: ${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
