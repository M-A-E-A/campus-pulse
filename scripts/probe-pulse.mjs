/**
 * Live pulse E2E — the door-rush simulation Phase 4 promises: an organizer
 * watches the projector counter while a ticket is scanned at the door, and
 * the number must tick WITHOUT a reload.
 *
 * Everything real: the student's ticket code comes from the same API their
 * ticket page uses; the organizer opens the projector screen (the
 * "N confirmations" line appearing from an initial total of 0 proves the
 * SSE snapshot arrived); the raw code is typed into the check-in screen's
 * manual box — the camera-free path a real door uses when the scanner dies
 * — and the counter must animate 0 → 1 on its own, same page, href
 * untouched.
 *
 * Logins are node-side (the probe-pwa.mjs / inspect-auth.mjs hand-rolled
 * jar → Auth.js credentials callback → Network.setCookie): clicking the
 * React login form from CDP proved flaky — the POST fires but the redirect
 * never lands. The door form below still gets a trusted CDP mouse click,
 * because there we only need the POST, which fires deterministically.
 *
 * Run scripts/reset-checkins.ts <eventId> first (this probe does it) so the
 * door starts closed and the run is repeatable.
 *
 * Usage: node scripts/probe-pulse.mjs   (prod server on :3100)
 */
import { spawn } from "node:child_process";
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const EVENT = "seed-event-line-follower";
const pulseUrl = `${origin}/organizer/events/${EVENT}/pulse`;
const checkinUrl = `${origin}/organizer/events/${EVENT}/check-in`;
const OUT = ".taste-skill";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

/** Same hand-rolled jar as scripts/probe-pwa.mjs: csrf → credentials
 *  callback → session token, returned with the full cookie header so API
 *  calls can reuse the session without a browser. */
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

/** The projector's big number: the only <p> whose whole text is a number
 *  (rounded integers only — the count-up never paints fractions). */
const readCounter = (page) =>
  page.eval(`([...document.querySelectorAll("p")].find((p) => /^\\d+$/.test(p.textContent.trim())) || {}).textContent ?? null`);

/** Put a session token in the shared cookie jar before the first navigation. */
async function authedPage(browser, token) {
  const page = await browser.newPage({ width: 1280, height: 900, dsf: 1 });
  await page.send("Network.setCookie", { name: "authjs.session-token", value: token, url: origin });
  return page;
}

const browser = await Browser.launch();
try {
  // Close the door: no stale check-ins, or the run would tick nothing.
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["--import", "tsx", "scripts/reset-checkins.ts", EVENT], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("exit", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`reset-checkins exit ${code}`))));
  }).then((out) => console.log(`reset: ${out}`));

  // 1. Student: their real ticket, the code the door scanner would read.
  const student = await login("student@campus.ma");
  const ticketRes = await fetch(`${origin}/api/events/${EVENT}/ticket`, {
    headers: { cookie: student.cookie },
  });
  const ticket = await ticketRes.json();
  check(
    "student ticket carries a code",
    ticketRes.status === 200 && typeof ticket?.ticketCode === "string" && ticket.ticketCode.length > 8,
    `status=${ticketRes.status} len=${ticket?.ticketCode?.length ?? 0}`
  );

  // 2. Organizer: the projector screen, door still closed.
  const org = await login("organiser@campus.ma");
  const pulse = await authedPage(browser, org.token);
  await pulse.goto(pulseUrl, { timeoutMs: 30000, settleMs: 1200 });

  // The SSE snapshot (total 0 → real count) must paint the confirmed line
  // the initial props alone could never render.
  let sawSnapshot = false;
  for (let i = 0; i < 20 && !sawSnapshot; i++) {
    sawSnapshot = await pulse.eval(
      `([...document.querySelectorAll("p")].some((p) => /confirm/i.test(p.textContent) && /\\d/.test(p.textContent)))`
    );
    if (!sawSnapshot) await sleep(400);
  }
  const before = await readCounter(pulse);
  check("SSE snapshot paints the live totals", sawSnapshot, `confirmed-line=${sawSnapshot}`);
  check("door starts closed", before === "0", `counter=${before}`);
  await pulse.screenshot({ path: `${OUT}/pulse-before.jpg`, quality: 88 });

  // 3. The door: type the raw code into the manual box (camera-free path),
  //    then a trusted mouse click on that form's submit button.
  const door = await authedPage(browser, org.token);
  await door.goto(checkinUrl, { timeoutMs: 30000, settleMs: 800 });
  await door.eval(
    ({ code }) => {
      const input = document.querySelector("form .input");
      // React owns the value — the native setter + an input event is what
      // makes the framework notice the keystroke.
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, code);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { code: ticket.ticketCode }
  );
  const box = await door.eval(`(() => {
    const form = document.querySelector("form .input").closest("form");
    const btn = form.querySelector("button");
    btn.scrollIntoView({ block: "center" });
    const r = btn.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  await sleep(150); // let the scroll settle before aiming
  await door.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await door.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });

  // Green banner only — a red/amber one would mean the scan was refused.
  let okBanner = false;
  for (let i = 0; i < 25 && !okBanner; i++) {
    await sleep(300);
    okBanner = await door.eval(
      `((el) => !!(el && el.className.includes("e6f4ea")))(document.querySelector('[role="status"]'))`
    );
  }
  check("door screen confirms the scan", okBanner, `green-banner=${okBanner}`);

  // 4. The projector ticks — same page, no reload, SSE poll ≤2.5s + 0.6s
  //    count-up; 10s is generous slack for a cold poll.
  const hrefBefore = await pulse.eval("location.href");
  let after = before;
  for (let i = 0; i < 25 && after === before; i++) {
    await sleep(400);
    after = await readCounter(pulse);
  }
  const hrefAfter = await pulse.eval("location.href");
  check("counter ticks live to 1", after === "1", `${before} → ${after}`);
  check("without a reload", hrefBefore === hrefAfter && hrefAfter === pulseUrl, hrefAfter);
  const reconnecting = await pulse.eval(
    `([...document.querySelectorAll('[role="status"]')].some((el) => /reconnect|reconnexion/i.test(el.textContent)))`
  );
  check("stream stays connected", reconnecting === false, `reconnecting=${reconnecting}`);
  await pulse.screenshot({ path: `${OUT}/pulse-after.jpg`, quality: 88 });

  await door.close();
  await pulse.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\nTOTAL: ${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
