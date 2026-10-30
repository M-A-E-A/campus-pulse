/**
 * Location-aware events E2E (Phase 8): "Near me" (click-gated geolocation,
 * km labels, nearest-first ordering), the campus auto-pick (persisted in
 * localStorage, overridable via the select), the detail page's distance
 * chip (renders ONLY when permission was already granted — a load never
 * prompts), and the denied path (honest hint, wall unchanged).
 *
 * Chromium is told it stands at Smartilab Hall B on the Roudani campus
 * (Emulation.setGeolocationOverride) with geolocation permission granted
 * via CDP Browser.grantPermissions, then every flow is driven through the
 * real UI. Campus/ordering assertions assume the seeded wall: 4 Roudani
 * events + "Pitch de minuit" at Campus Maarif.
 *
 * Usage: node scripts/probe-geo.mjs   (prod server on :3100)
 */
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const OUT = ".taste-skill";
const ROUDANI = { latitude: 33.5735, longitude: -7.5879, accuracy: 20 }; // Hall B

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

const has = (page, sel) => page.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
const firstTitle = (page) =>
  page.eval(`(document.querySelector("[data-flip-id] h3")?.innerText ?? "")`);
const firstHasKm = (page) =>
  page.eval(`((document.querySelector("[data-flip-id]")?.innerText ?? "").includes(" km"))`);
const campusValue = (page) =>
  page.eval(`(document.querySelector("[data-campus]")?.value ?? null)`);
const storage = (page, key) =>
  page.eval(`localStorage.getItem(${JSON.stringify(key)})`);

/** Trusted CDP click — the house pattern (scroll, settle, real mouse events). */
async function click(page, sel) {
  const box = await page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (!box) throw new Error(`click target missing: ${sel}`);
  await sleep(150);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
}

/** React-friendly select change (native setter + bubbling change event). */
async function selectCampus(page, value) {
  await page.eval((v) => {
    const sel = document.querySelector("[data-campus]");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    setter.call(sel, v);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return sel.value;
  }, value);
  await sleep(800); // Flip reorder settles
}

const main = async () => {
  const browser = await Browser.launch();
  try {
    await browser.send("Browser.grantPermissions", {
      origin,
      permissions: ["geolocation"],
    });
    const page = await browser.newPage({ width: 1280, height: 900 });
    await page.send("Emulation.setGeolocationOverride", { ...ROUDANI });

    // Cold start: no persisted campus preference.
    await page.goto(`${origin}/events`);
    await page.eval(`localStorage.removeItem("cp-campus")`);
    await page.goto(`${origin}/events`);

    // 1 — the wall ships with both location controls.
    const cards = await page.eval(`document.querySelectorAll("[data-flip-id]").length`);
    const near = await has(page, "[data-near]");
    const campus = await has(page, "[data-campus]");
    check(
      "Wall renders with the location controls",
      cards >= 3 && near && campus,
      `${cards} cards, near=${near}, campus=${campus}`
    );

    // 2 — near me: every card that has coordinates gets a km label.
    await click(page, "[data-near]");
    await sleep(1300); // permission + reorder + Flip
    const kmCards = await page.eval(
      `[...document.querySelectorAll("[data-flip-id]")].filter((c) => c.innerText.includes(" km")).length`
    );
    check(
      "Near-me puts km labels on the cards",
      kmCards >= 4,
      `${kmCards} of ${cards} cards carry a km label`
    );
    await page.screenshot({ path: `${OUT}/probe-geo-wall.jpg` });

    // 3 — nearest-first: standing at Smartilab Hall B, the workshop there wins.
    const t3 = await firstTitle(page);
    check(
      "Nearest-first ordering (Roudani)",
      t3.includes("Atelier robotique"),
      `first card: ${t3.slice(0, 40)}`
    );

    // 4 — the first grant auto-picks the nearest campus and persists it.
    const picked = await storage(page, "cp-campus");
    const sel4 = await campusValue(page);
    check(
      "Campus auto-picked and persisted",
      picked === "roudani" && sel4 === "roudani",
      `localStorage=${picked}, select=${sel4}`
    );

    // 5 — toggling near-me off removes the labels (campus preference stays).
    await click(page, "[data-near]");
    await sleep(900);
    const stillKm = await firstHasKm(page);
    check(
      "Toggling near-me off removes the km labels",
      !stillKm,
      stillKm ? "label still on the first card" : "labels gone"
    );

    // 6 — campus preference orders the (date-ordered) wall: the only Maarif
    // event must come first once "EMSI Maarif" is selected.
    await selectCampus(page, "maarif");
    const t6 = await firstTitle(page);
    check(
      "Campus selection orders the wall (Maarif first)",
      t6.includes("Pitch de minuit"),
      `first card: ${t6.slice(0, 40)}`
    );

    // 7 — the selection survives a reload.
    await page.goto(`${origin}/events`);
    await sleep(900);
    const v7 = await campusValue(page);
    const t7 = await firstTitle(page);
    check(
      "Campus selection survives a reload",
      v7 === "maarif" && t7.includes("Pitch de minuit"),
      `select=${v7}, first=${t7.slice(0, 30)}`
    );

    // 8 — clearing the select restores plain date order + drops the stored pick.
    await selectCampus(page, "");
    const t8 = await firstTitle(page);
    const g8 = await storage(page, "cp-campus");
    check(
      "Clearing the campus restores date order",
      t8.includes("Atelier robotique") && g8 === null,
      `first=${t8.slice(0, 30)}, storage=${g8}`
    );

    // 9 — the detail page's distance chip renders BECAUSE permission is
    // already granted (never a prompt on load). The new target needs its
    // own geolocation override — Emulation state is per-renderer.
    const detail = await browser.newPage({ width: 1280, height: 900 });
    await detail.send("Emulation.setGeolocationOverride", { ...ROUDANI });
    await detail.goto(`${origin}/events/seed-event-line-follower`);
    await sleep(1200);
    const chip = await detail.eval(`(document.querySelector("[data-distance]")?.innerText ?? "")`);
    check(
      "Detail distance chip renders when permission is granted",
      chip.includes("km"),
      `chip: "${chip}"`
    );
    await detail.screenshot({ path: `${OUT}/probe-geo-detail.jpg` });
    await detail.close();

    // 10 — denied path: reset the grant (default = prompt, which headless
    // denies) — the wall must show the honest hint and stay date-ordered.
    await browser.send("Browser.grantPermissions", { origin, permissions: [] });
    const denied = await browser.newPage({ width: 1280, height: 900 });
    await denied.goto(`${origin}/events`);
    await click(denied, "[data-near]");
    let hint = false;
    for (let i = 0; i < 48; i++) { // geolocation denial may take up to the 8s timeout
      if (await denied.eval(`document.body.innerText.includes("Localisation indisponible")`)) { hint = true; break; }
      await sleep(250);
    }
    const pressed = await denied.eval(
      `document.querySelector("[data-near]")?.getAttribute("aria-pressed")`
    );
    check(
      "Denied geolocation shows the honest hint, no reorder",
      hint && pressed === "false",
      `hint=${hint}, aria-pressed=${pressed}`
    );
    await denied.screenshot({ path: `${OUT}/probe-geo-denied.jpg` });
    await denied.close();

    await page.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-geo: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
