/**
 * Quick win 2 E2E: the ticket page's two exports.
 *
 * Part A (print) — "Save ticket" must offer the honest PDF hint, and
 * under `Emulation.setEmulatedMedia print` the page must actually BE
 * the pass: site header and every app affordance gone, the ink band
 * inverted to ink-on-white (browsers do not print backgrounds, so the
 * un-inverted band would be white-on-white — an invisible ticket),
 * QR + code still rendered.
 *
 * Part B (Apple pass) — the shipped state is the UNCONFIGURED one: the
 * ticket shows the honest note instead of a button, and the route says
 * 503 not_configured. Guards: anon 401, stranger 403.
 *
 * UI language is French (Chromium Accept-Language=fr); assertions use
 * exact dict copy or ASCII-safe substrings.
 *
 * Usage: node scripts/probe-pass.mjs   (prod server on :3100)
 */
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const OUT = ".taste-skill";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

const has = (page, sel) => page.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
const textOf = (page, sel) =>
  page.eval(`(document.querySelector(${JSON.stringify(sel)})?.textContent ?? "").trim()`);
const styleOf = (page, sel, prop) =>
  page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    return el ? getComputedStyle(el)[${JSON.stringify(prop)}] : null;
  })()`);
const fetchJson = (page, url) =>
  page.eval(`fetch(${JSON.stringify(url)}).then(async (r) => ({ s: r.status, b: await r.json().catch(() => null) }))`);

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

/** Trusted CDP click — the house pattern (mouseMoved before press, the
 *  target scrolled into view only when it isn't already on screen). */
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
  await sleep(350);
  const box = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (!box) throw new Error(`click target vanished: ${sel}`);
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, buttons: 0 });
  await sleep(60);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1, buttons: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1, buttons: 0 });
}

/**
 * Log in through the real UI. Hardened beyond a bare click: React owns
 * the submit, so the form must be hydrated first (a pre-hydration click
 * hits a form with no native action and simply dies — probe-wallet
 * documented the same flake), delivery is listener-verified, and a DOM
 * click stands in if Chrome ate the trusted one. Retries once.
 */
async function login(page, email) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(`${origin}/login`);
    let hydrating = true;
    for (let i = 0; i < 40 && hydrating; i++) {
      hydrating = !(await page.eval(`(() => {
        const f = document.querySelector("form");
        return !!(f && Object.keys(f).some((k) => k.startsWith("__reactProps")));
      })()`));
      if (hydrating) await sleep(250);
    }
    console.log(`  login(${email}) hydrated=${!hydrating} attempt=${attempt + 1}`);
    await fill(page, 'input[name="email"]', email);
    await fill(page, 'input[name="password"]', "password123");
    await page.eval(`(() => {
      window.__clickDelivered = false;
      document.addEventListener("click", () => { window.__clickDelivered = true; }, true);
      return true;
    })()`);
    await click(page, "form .btn-primary");
    let delivered = false;
    for (let i = 0; i < 6 && !delivered; i++) {
      delivered = await page.eval(`window.__clickDelivered`);
      if (!delivered) await sleep(150);
    }
    if (!delivered) {
      await page.eval(`(() => { document.querySelector("form .btn-primary")?.click(); return true; })()`);
    }
    for (let i = 0; i < 40; i++) {
      const r = await page.send("Network.getCookies", { urls: [origin] });
      const names = (r.cookies ?? []).map((c) => c.name);
      if (names.includes("authjs.session-token") || names.includes("__Host-next-auth.session-token")) return true;
      await sleep(250);
    }
    console.log(`  login attempt ${attempt + 1} produced no session cookie`);
  }
  return false;
}

/** Sign out through the real form: wait for React to hydrate it, arm a
 *  listener before the trusted click, DOM-click if it was swallowed. */
async function logout(page) {
  let hydrating = true;
  for (let i = 0; i < 40 && hydrating; i++) {
    hydrating = !(await page.eval(`(() => {
      const f = document.querySelector("[data-logout]")?.form;
      return !!(f && Object.keys(f).some((k) => k.startsWith("__reactProps")));
    })()`));
    if (hydrating) await sleep(250);
  }
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
    await page.eval(`(() => { document.querySelector("[data-logout]")?.click(); return true; })()`);
  }
  for (let i = 0; i < 24; i++) {
    if (await page.eval(`location.pathname === "/"`)) return true;
    await sleep(250);
  }
  return false;
}

const main = async () => {
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1280, height: 900 });

    // 1 — the pass route must be closed before any session exists.
    await page.goto(`${origin}/login`);
    const anon = await fetchJson(page, "/api/tickets/00000000000000000000000000000000/pass");
    check("Anonymous pass request → 401", anon.s === 401, `status=${anon.s}`);

    // 2 — log in as Salma and find her ticket the way a student does.
    const logged = await login(page, "student@campus.ma");
    check("Login lands a session cookie", logged, logged ? "session token set" : "no token after 8s");
    await page.goto(`${origin}/dashboard`);
    const entry = await waitFor(page, "[data-fullscreen-ticket]");
    const ticketUrl = await page.eval(
      `document.querySelector("[data-fullscreen-ticket]")?.getAttribute("href") ?? ""`
    );
    check("Dashboard links to the full-screen ticket", entry && ticketUrl.startsWith("/tickets/"), ticketUrl || "no entry");
    const rsvpId = ticketUrl.split("/").filter(Boolean).pop() ?? "";

    await page.goto(`${origin}${ticketUrl}`);
    const confirmed = await waitFor(page, '[data-ticket="confirmed"]');
    const qrUp = await waitFor(page, "[data-qr]", 48);
    check("Ticket renders with QR", confirmed && qrUp, `state=${confirmed} qr=${qrUp}`);

    // 3 — Part A UI: the print button + the honest Save-as-PDF hint (FR).
    const printBtn = await waitFor(page, "[data-printbtn]");
    const printLabel = await textOf(page, "[data-printbtn]");
    check(
      "Save ticket button present with FR label",
      printBtn && printLabel === "Enregistrer le billet",
      `label="${printLabel}"`
    );
    const hint = await textOf(page, "[data-savehint]");
    check(
      "Print hint names the Save-as-PDF choice",
      hint.includes("Enregistrer au format PDF"),
      `hint="${hint.slice(0, 60)}…"`
    );

    // 4 — Part B shipped state: honest NOTE, no dead CTA, no error.
    const note = await textOf(page, "[data-walletnote]");
    const walletBtn = await has(page, "[data-wallet]");
    const walletErr = await has(page, "[data-walleterror]");
    check(
      "Unconfigured wallet shows the honest note (no button)",
      note.includes("pas configuré sur ce serveur") && !walletBtn && !walletErr,
      `note="${note.slice(0, 52)}…" button=${walletBtn} error=${walletErr}`
    );

    // 5 — route agrees with the UI: 503 + machine-readable reason.
    const pass = await fetchJson(page, `/api/tickets/${rsvpId}/pass`);
    check(
      "Pass route answers honest 503 not_configured",
      pass.s === 503 && pass.b?.reason === "not_configured",
      `status=${pass.s} reason=${pass.b?.reason ?? "<none>"}`
    );

    await page.screenshot({ path: `${OUT}/probe-pass-screen.jpg` });

    // 6 — print media: the page must BE the pass.
    await page.send("Emulation.setEmulatedMedia", { media: "print" });
    await sleep(250);
    const headHidden = (await styleOf(page, "header", "display")) === "none";
    check("Print: site header drops out", headHidden, `display=${await styleOf(page, "header", "display")}`);

    const actionsHidden = (await styleOf(page, "[data-ticketactions]", "display")) === "none";
    const hintHidden = (await styleOf(page, "[data-savehint]", "display")) === "none";
    // The wake switch lives inside its own print-hidden wrapper: a child
    // of a display:none box still reports ITS OWN display, so judge the
    // marked ancestor instead.
    const wakeWrap = await page.eval(`(() => {
      const el = document.querySelector("[data-wake]");
      if (!el) return null;
      return getComputedStyle(el.closest("[data-print-hide]") ?? el).display;
    })()`);
    check(
      "Print: app affordances hidden",
      actionsHidden && hintHidden && wakeWrap === "none",
      `actions=${await styleOf(page, "[data-ticketactions]", "display")} hint=${await styleOf(page, "[data-savehint]", "display")} wakeWrap=${wakeWrap}`
    );

    const headBg = await styleOf(page, "[data-tickethead]", "backgroundColor");
    const h1Color = await styleOf(page, "[data-ticket] h1", "color");
    check(
      "Print: ink band inverted to ink-on-white",
      headBg === "rgb(255, 255, 255)" && h1Color !== "rgb(255, 255, 255)",
      `bandBg=${headBg} h1=${h1Color}`
    );

    const qrPrint = await page.eval(`(() => {
      const img = document.querySelector("[data-qr]");
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return { shown: getComputedStyle(img).display !== "none" && r.width > 0, natural: img.naturalWidth };
    })()`);
    const codePrint = await page.eval(`(() => {
      const el = document.querySelector("[data-code]");
      if (!el) return null;
      return el.getBoundingClientRect().height > 0 && el.textContent.trim().length > 0;
    })()`);
    check(
      "Print: QR and code stay visible",
      qrPrint?.shown && qrPrint.natural > 0 && codePrint,
      `qr=${JSON.stringify(qrPrint)} code=${codePrint}`
    );
    await page.screenshot({ path: `${OUT}/probe-pass-print.jpg` });

    // 7 — back to screen media: chrome returns (emulation really was the
    //     only thing hiding it — no accidental page state).
    await page.send("Emulation.setEmulatedMedia", {});
    await sleep(250);
    const headBack = (await styleOf(page, "header", "display")) !== "none";
    const btnBack = (await styleOf(page, "[data-printbtn]", "display")) !== "none";
    check("Screen media restores chrome + button", headBack && btnBack, `header=${headBack} btn=${btnBack}`);

    // 8 — stranger: Salma's pass, Omar's session → 403.
    const out = await logout(page);
    check("Sign-out returns home", out, await page.eval(`location.pathname`));
    const omar = await login(page, "organiser@campus.ma");
    check("Organiser session up", omar, omar ? "session token set" : "no token after 8s");
    const stranger = await fetchJson(page, `/api/tickets/${rsvpId}/pass`);
    check("Stranger pass request → 403", stranger.s === 403, `status=${stranger.s}`);

    await page.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-pass: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
