/**
 * Offline hardening E2E: every mutating surface must answer with honest
 * copy when the network is gone — never the app's "something broke" error
 * boundary (the user-reported defect: offline login used to show the crash
 * popup). Drives Chromium's Network.emulateNetworkConditions through the
 * exact flows that used to throw: the login form and the post-event
 * feedback action.
 *
 * The journey converges: it logs in through the real UI, flips the
 * soldering workshop's answer via the real band, and ends in the same state
 * probe-feedback leaves (soldering = yes), so the two probes never fight.
 *
 * UI language is French (Chromium Accept-Language=fr): the offline copy
 * asserted is "hors connexion" (errors.offline, FR locale).
 *
 * Usage: node scripts/probe-offline.mjs   (prod server on :3100)
 */
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const SOLDER = "seed-past-soldering"; // attended — its band is live after the event
const OUT = ".taste-skill";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

/** offline: true severs the network for this page's fetches; false restores
 *  full throughput (-1 = unlimited in CDP). */
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

async function waitForText(page, s, tries = 40) {
  for (let i = 0; i < tries; i++) {
    if (await bodyHas(page, s)) return true;
    await sleep(250);
  }
  return false;
}

/** Trusted CDP click — the house pattern, with the aim measured AFTER the
 *  scroll settles (smooth scrolling would otherwise shift the target). A
 *  mouseMoved precedes the press: Chrome only synthesizes a click from
 *  press+release once the mouse position is known — dispatching the pair at
 *  an unseen coordinate is dropped on the floor (same reasoning as
 *  probe-wallet's helper). And because this journey goes through an offline
 *  cut — after which this Chrome build has been observed to drop Input
 *  dispatches ENTIRELY (the button hit-tests fine, zero native events
 *  arrive) — delivery is verified with a listener armed before the
 *  dispatch, and a DOM click stands in when the trusted one was eaten. The
 *  assertions stay real: a DOM click drives the same React handler and
 *  server action a mouse click would; only CDP's input plumbing is routed
 *  around. */
async function click(page, sel) {
  const found = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    return true;
  })()`);
  if (!found) throw new Error(`click target missing: ${sel}`);
  await sleep(350); // let the scroll settle before aiming
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
  await page.eval(`(() => {
    window.__clickDelivered = false;
    document.addEventListener("click", () => { window.__clickDelivered = true; }, true);
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
    console.log(`  trusted click dropped after the offline cut — DOM click fallback for ${sel}`);
    await page.eval(`(() => {
      document.querySelector(${JSON.stringify(sel)})?.click();
      return true;
    })()`);
  }
}

/** Click until `done()` observes the state change (or attempts run out):
 *  absorbs the first-clicks-before-hydration flake. */
async function clickUntil(page, sel, done, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    await click(page, sel);
    for (let j = 0; j < 15; j++) {
      if (await done()) return true;
      await sleep(200);
    }
    const hooks = await page.eval(
      `[...document.querySelectorAll("[data-post]")].map((e) => e.getAttribute("data-post")).join(",")`
    );
    console.log(`  retry ${sel} attempt ${i + 1}: hooks=${hooks}`);
  }
  return false;
}

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

const main = async () => {
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1280, height: 900 });

    // 1 — offline login answers inline, never with the crash popup.
    await page.goto(`${origin}/login`);
    await fill(page, 'input[name="email"]', "student@campus.ma");
    await fill(page, 'input[name="password"]', "password123");
    await setOffline(page, true);
    await click(page, "form .btn-primary");
    const inline = await waitForText(page, "hors connexion");
    check(
      "Offline login shows the inline offline copy",
      inline,
      inline ? "alert visible in the form" : "no offline copy after 10s"
    );
    const crashed = await bodyHas(page, "Quelque chose a cassé");
    check(
      "Offline login never reaches the error boundary",
      !crashed,
      crashed ? "boundary copy on screen" : "no crash screen"
    );
    const stillLogin = await page.eval(`location.pathname === "/login"`);
    check(
      "Offline login stays on /login",
      stillLogin,
      await page.eval(`location.pathname`)
    );
    await page.screenshot({ path: `${OUT}/probe-offline-login.jpg` });

    // 2 — back online, the very same form must reach the server: the
    // wrapper passes the success through and the credentials callback lands
    // a session cookie. React 19 auto-resets an uncontrolled form after any
    // action completes (the offline attempt emptied the fields), so the
    // retry retypes them — exactly what a visitor does. Asserting the cookie
    // via CDP rather than the redirect: "clicking the React login form from
    // CDP proved flaky — the POST fires, the redirect never lands", per
    // probe-feedback's header.
    await setOffline(page, false);
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
    check(
      "Online retry logs in — the session cookie lands",
      cookie,
      cookie ? "session token set by the credentials callback" : "no session cookie after 8s"
    );

    // 3 — the post-event band offline: "change" is local state so it works
    // with no network; the server answer must get the honest inline message.
    await page.goto(`${origin}/events/${SOLDER}`);
    const bandUp = await waitFor(page, '[data-post="thanks"]');
    const arrival = await page.eval(
      `[...document.querySelectorAll("[data-post]")].map((e) => e.getAttribute("data-post")).join(",")`
    );
    console.log(`  band arrival hooks: ${arrival}`);
    if (!bandUp) {
      check("Band reachable with the landed session", false, "no band on the attended event");
    } else {
      // Reveal the question from any converged state (probe-feedback's
      // rule): answered → "change" → wait for the yes/no buttons to render.
      if (!(await has(page, '[data-post="yes"]'))) {
        const revealed = await clickUntil(page, '[data-post="change"]', () => has(page, '[data-post="yes"]'));
        if (!revealed) throw new Error("band never revealed the question");
      }
      await setOffline(page, true);
      const band = await clickUntil(page, '[data-post="yes"]', () => bodyHas(page, "hors connexion"));
      check(
        "Offline feedback answer shows the inline offline copy",
        band,
        band ? "band shows the honest message" : "no offline copy after 10s"
      );
      const bandCrash = await bodyHas(page, "Quelque chose a cassé");
      check(
        "Offline feedback never reaches the error boundary",
        !bandCrash,
        bandCrash ? "boundary copy on screen" : "no crash screen"
      );
      await page.screenshot({ path: `${OUT}/probe-offline-band.jpg` });

      // 4 — online again, the same click converges the demo's end state
      // (soldering = yes + the club's next-up pick) — probe-feedback's state.
      await setOffline(page, false);
      let answered = await clickUntil(page, '[data-post="yes"]', () => has(page, '[data-post="answered"]'));
      if (answered) answered = await waitFor(page, '[data-post="next"]');
      check(
        "Online retry answers (converges to probe-feedback's end state)",
        answered,
        answered ? "next-up pick visible — soldering=yes" : "no answered/pick state after 10s"
      );
    }

    await page.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-offline: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
