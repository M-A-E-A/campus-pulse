/**
 * Offline ticket wallet E2E: the standalone `/tickets/[rsvpId]` page must
 * still open when the network is gone — that is the entire reason the
 * route exists, and it is the ONE route the service worker is allowed to
 * cache (public/sw.js, header). It also proves the two safety valves that
 * make that exception honest: the copy is served only while the network is
 * unreachable, and sign-out deletes it.
 *
 * The offline cut is applied to the PAGE and to the SERVICE WORKER: a SW
 * fetches in its own agent, so throttling only the page would leave the SW
 * cheerfully reaching the network and the test would pass without ever
 * touching the cache path it claims to cover.
 *
 * UI language is French (Chromium Accept-Language=fr). Assertions lean on
 * data-* hooks because aria-labels and button copy translate.
 *
 * Usage: node scripts/probe-wallet.mjs   (prod server on :3100)
 */
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const OUT = ".taste-skill";
const TICKET_CACHE = "cp-ticket-v1";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

const has = (page, sel) => page.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
const textOf = (page, sel) =>
  page.eval(`(document.querySelector(${JSON.stringify(sel)})?.textContent ?? "").trim()`);

const waitFor = async (page, sel, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (await has(page, sel)) return true;
    await sleep(250);
  }
  return false;
};

/** React-friendly value set on a controlled/uncontrolled input. */
async function fill(page, sel, value) {
  await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
}

/** Trusted CDP click — the house pattern. Does NOT scroll when the target
 *  is already fully on screen: this app's header is `position: sticky`, so
 *  scrollIntoView re-centres the DOCUMENT while the header stays pinned —
 *  the rect then lies about where the button will be after the scroll
 *  settles, and the click lands on whatever moved under it. */
async function click(page, sel) {
  const ready = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const onScreen = r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
    if (!onScreen) el.scrollIntoView({ block: "center" });
    return true;
  })()`);
  if (!ready) throw new Error(`click target missing: ${sel}`);
  await sleep(350); // let any scroll settle before aiming
  const box = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (!box) throw new Error(`click target vanished: ${sel}`);
  const top = await page.eval(`(() => {
    const el = document.elementFromPoint(${box.x}, ${box.y});
    return el ? el.tagName + "." + String(el.className).slice(0, 34) : "none";
  })()`);
  console.log(`  click ${sel} @ ${box.x},${box.y} topmost=${top}`);
  // Move first: Chrome only synthesizes a click from press+release once the
  // mouse position is known — dispatching the pair at an unseen coordinate
  // is dropped on the floor and no event ever reaches the document. (This
  // is why Playwright always mouse.move()s before clicking.)
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, buttons: 0 });
  await sleep(60);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1, buttons: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1, buttons: 0 });
}

/** Cut (or restore) the network for the page AND every service worker.
 *  SW sessions are cached: re-attaching per call would leak sessions. */
const swSessions = new Map();
async function swSession(browser, targetId) {
  if (swSessions.has(targetId)) return swSessions.get(targetId);
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  swSessions.set(targetId, sessionId);
  return sessionId;
}

/** Detach every worker session once the offline cut is finished, so the
 *  remaining steps talk only to the page target. */
async function releaseSwSessions(browser, page) {
  for (const sid of swSessions.values()) {
    await browser.send("Target.detachFromTarget", { sessionId: sid }).catch(() => {});
  }
  swSessions.clear();
  await browser.send("Target.activateTarget", { targetId: page.targetId }).catch(() => {});
}

const conditions = (off) => ({
  offline: off,
  latency: 0,
  downloadThroughput: off ? 0 : -1,
  uploadThroughput: off ? 0 : -1,
});

async function setOffline(browser, page, off) {
  await page.send("Network.enable");
  await page.send("Network.emulateNetworkConditions", conditions(off));

  const { targetInfos } = await browser.send("Target.getTargets");
  for (const t of targetInfos) {
    if (t.type !== "service_worker") continue;
    try {
      const sid = await swSession(browser, t.targetId);
      await browser.send("Network.enable", {}, sid);
      await browser.send("Network.emulateNetworkConditions", conditions(off), sid);
      // A hard block on top of throttling: it does not depend on how a given
      // Chrome build attributes emulateNetworkConditions to a SW target.
      await browser.send("Network.setBlockedURLs", { urls: off ? ["*localhost:3100*"] : [] }, sid);
    } catch (e) {
      // Loud, not silent: if the SW stays online the offline assertions
      // below would pass without ever touching the cache path.
      console.log(`  SW cut failed for ${t.targetId}: ${e.message}`);
    }
  }
}

const cacheKeys = (page) => page.eval(`caches.keys()`);
const hasSavedTicket = (page, url) =>
  page.eval(`(async () => {
    const hit = await caches.match(${JSON.stringify(url)});
    return !!hit;
  })()`);

const main = async () => {
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1280, height: 900 });

    // 1 — log in through the real UI (fresh profile: no session, no SW yet).
    await page.goto(`${origin}/login`);
    await fill(page, 'input[name="email"]', "student@campus.ma");
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
    check("Login lands a session cookie", cookie, cookie ? "credentials callback set the token" : "no token after 8s");

    // 2 — the wallet entry point is discoverable from the dashboard.
    await page.goto(`${origin}/dashboard`);
    const entry = await waitFor(page, "[data-fullscreen-ticket]");
    const ticketUrl = await page.eval(
      `document.querySelector("[data-fullscreen-ticket]")?.getAttribute("href") ?? ""`
    );
    check(
      "Dashboard links to the full-screen ticket",
      entry && ticketUrl.startsWith("/tickets/"),
      entry ? `href=${ticketUrl}` : "no [data-fullscreen-ticket] after 10s"
    );
    await page.screenshot({ path: `${OUT}/probe-wallet-dashboard.jpg` });

    // 3 — the worker must be registered AND controlling this page before we
    // navigate, or the first ticket fetch would bypass it and never be saved.
    const controlled = await page.eval(`(async () => {
      const reg = await navigator.serviceWorker.ready;
      for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
      return !!(reg.active && navigator.serviceWorker.controller);
    })()`);
    check("Service worker registered and controlling", controlled, controlled ? "controller present" : "no controller after 10s");

    // 4 — online: the ticket itself renders, with a rotating QR and the
    // anti-screenshot note (honest here: the mint route answers).
    await page.goto(`${origin}${ticketUrl}`);
    const confirmed = await waitFor(page, '[data-ticket="confirmed"]');
    check("Ticket page renders confirmed state", confirmed, confirmed ? "data-ticket=confirmed" : "no state hook after 10s");

    const qrUp = await waitFor(page, "[data-qr]", 48);
    const code = await textOf(page, "[data-code]");
    check("QR and legible code render", qrUp && code.length > 0, `qr=${qrUp} code=${code.slice(0, 12)}…`);

    const wake = await has(page, "[data-wake]");
    check("Wake-lock switch present", wake, wake ? "[data-wake] toggle rendered" : "no switch");

    // `p:has(svg)` is the rotating-hint paragraph — locale-proof, since the
    // sentence itself is translated (FR: "…une capture d'écran…").
    const hintOnline = await has(page, "[data-fullticket] p:has(svg)");
    check(
      "Anti-screenshot hint visible while the QR is signed",
      hintOnline,
      hintOnline ? "hint shown (mint succeeded)" : "hint missing while online"
    );
    await page.screenshot({ path: `${OUT}/probe-wallet-online.jpg` });

    // 5 — the SW saved this route's HTML. Poll: the cache write happens in
    // the fetch handler, after the navigation has already resolved.
    let saved = false;
    for (let i = 0; i < 24 && !saved; i++) {
      const keys = await cacheKeys(page);
      saved = keys.includes(TICKET_CACHE) && (await hasSavedTicket(page, `${origin}${ticketUrl}`));
      if (!saved) await sleep(250);
    }
    check(
      "Service worker cached the ticket page",
      saved,
      saved ? `caches contain ${TICKET_CACHE} entry for the ticket URL` : `keys=${(await cacheKeys(page)).join(",")}`
    );

    // 6 — ownership: an id that isn't yours answers 404, never 403 (a
    // "forbidden" is an admission the id exists).
    const bogus = await page.eval(
      `fetch("/tickets/00000000000000000000000000000000").then((r) => r.status)`
    );
    check("Foreign/absent rsvpId answers 404", bogus === 404, `status=${bogus}`);

    // 7 — offline: navigate again. The page must come from the saved copy.
    await setOffline(browser, page, true);
    let navOk = true;
    try {
      await page.goto(`${origin}${ticketUrl}`, { timeoutMs: 15000, settleMs: 2500 });
    } catch (e) {
      navOk = false;
      console.log(`  offline navigate reported: ${e.message}`);
    }
    const offState = await waitFor(page, '[data-ticket="confirmed"]', 32);
    check(
      "Offline: the ticket still opens",
      navOk && offState,
      offState ? "saved copy rendered the confirmed ticket" : `navOk=${navOk} state=${offState}`
    );

    const offCode = await textOf(page, "[data-code]");
    check("Offline: the code stays legible", offCode.length > 0, `code=${offCode.slice(0, 12)}…`);

    const banner = await waitFor(page, "[data-ticketoffline]", 24);
    check("Offline: honest banner shown", banner, banner ? "[data-ticketoffline] visible" : "no banner after 6s");

    // QR must exist AND the rotation hint must be gone: the mint route is
    // unreachable, so the QR encodes the RAW code (which the door accepts).
    const qrOff = await waitFor(page, "[data-qr]", 32);
    const hintOff = await has(page, "[data-fullticket] p:has(svg)");
    check(
      "Offline: QR degrades to the raw code, hint suppressed",
      qrOff && !hintOff,
      `qr=${qrOff} hint=${hintOff} (hint would be a lie over a static code)`
    );
    await page.screenshot({ path: `${OUT}/probe-wallet-offline.jpg` });

    // 8 — back online, then sign out: the saved credential must die with
    // the session, which is what makes caching this one route safe.
    await setOffline(browser, page, false);
    await releaseSwSessions(browser, page);
    await page.goto(`${origin}${ticketUrl}`);
    console.log(`  back online: navigator.onLine=${await page.eval(`navigator.onLine`)}`);
    let landedHome = false;
    // Wait for hydration before the first click: React owns this submit
    // handler, and a click on pre-hydration markup does nothing at all —
    // the form has no native action to fall back on. Without this the whole
    // step flakes (three "silently dropped" clicks in a row), which reads
    // like an app bug when it is only a timing one.
    let hydrating = true;
    for (let i = 0; i < 40 && hydrating; i++) {
      hydrating = !(await page.eval(`(() => {
        const f = document.querySelector("[data-logout]")?.form;
        return !!(f && Object.keys(f).some((k) => k.startsWith("__reactProps")));
      })()`));
      if (hydrating) await sleep(250);
    }
    console.log(`  logout form hydrated=${!hydrating}`);
    for (let attempt = 0; attempt < 3 && !landedHome; attempt++) {
      // A trusted CDP click is the default, but after the offline cut this
      // page's input pipeline can silently DROP Input.dispatchMouseEvent:
      // the button hit-tests fine yet zero native clicks reach the document
      // (measured: three dispatches, no click event, no submit). Delivery is
      // therefore verified with a listener armed BEFORE the dispatch, and a
      // DOM click stands in when Chrome ate the trusted one. What this step
      // tests is the form action + cache purge + redirect — not CDP's input
      // plumbing (same precedent as the node-side login above, which exists
      // because the React login form proved just as flaky from CDP).
      await page.eval(`(() => {
        window.__clickDelivered = false;
        document.addEventListener("click", () => { window.__clickDelivered = true; }, true);
        return true;
      })()`);
      await click(page, "[data-logout]");
      let delivered = false;
      for (let i = 0; i < 6 && !delivered; i++) {
        delivered = await page.eval(`window.__clickDelivered`);
        if (!delivered) await sleep(150);
      }
      if (!delivered) {
        console.log(`  trusted click dropped after the offline cut — falling back to a DOM click`);
        await page.eval(`(() => {
          document.querySelector("[data-logout]")?.click();
          return true;
        })()`);
      }
      for (let i = 0; i < 24; i++) {
        if (await page.eval(`location.pathname === "/"`)) { landedHome = true; break; }
        await sleep(250);
      }
      if (!landedHome) {
        const ck = await page.send("Network.getCookies", { urls: [origin] });
        console.log(
          `  logout attempt ${attempt + 1} still at ${await page.eval(`location.pathname`)}` +
            ` vis=${await page.eval(`document.visibilityState`)} focus=${await page.eval(`document.hasFocus()`)}` +
            ` online=${await page.eval(`navigator.onLine`)}` +
            ` cookies=${(ck.cookies ?? []).map((c) => c.name).join("+") || "none"}`
        );
      }
    }
    check("Sign-out returns to the landing page", landedHome, await page.eval(`location.pathname`));

    let purged = false;
    for (let i = 0; i < 24 && !purged; i++) {
      const keys = await cacheKeys(page);
      purged = !keys.includes(TICKET_CACHE);
      if (!purged) await sleep(250);
    }
    check(
      "Sign-out purges the saved ticket cache",
      purged,
      purged ? `${TICKET_CACHE} gone — shared machine cannot replay it` : `keys=${(await cacheKeys(page)).join(",")}`
    );

    await page.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-wallet: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
