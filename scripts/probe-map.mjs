/**
 * Campus map view E2E (Phase 10): the third view in the events explorer.
 *
 * Asserts the hand-drawn SVG map really is the data it claims to be —
 * every pin projected from an event's own lat/lng, pins individually
 * clickable, the selected pin's card reusing the wall's poster slot,
 * filters still narrowing the map, the "you are here" marker gated behind
 * the same consent as Phase 8, and — because no seeded public event lacks
 * coordinates — a temporary coordinate-less event is created and removed
 * around the run to prove the "Not on the map" list keeps it visible.
 *
 * Usage: node scripts/probe-map.mjs   (prod server on :3100)
 */
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const OUT = ".taste-skill";
const ROUDANI = { latitude: 33.5735, longitude: -7.5879, accuracy: 20 };

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

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

const pinCount = (page) => page.eval(`document.querySelectorAll("[data-pin]").length`);
const panelTitle = (page) =>
  page.eval(`(document.querySelector("[data-flip-id] h3")?.innerText ?? "")`);
const hintShown = (page) =>
  page.eval(`document.body.innerText.includes("Sélectionnez un repère")`);

/** Create/remove a PUBLISHED upcoming event with no coordinates, so the
 *  "Not on the map" branch is exercised against real data. */
async function makeNoVenueEvent() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const club = await prisma.club.findFirst({ select: { id: true } });
  const category = await prisma.category.findFirst({ select: { id: true } });
  const id = "probe-map-novenue";
  const startsAt = new Date(Date.now() + 5 * 864e5);
  await prisma.event.upsert({
    where: { id },
    create: {
      id,
      title: "Visite d'un partenaire — lieu à confirmer",
      description: "Événement temporaire du probe : aucunes coordonnées.",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * 36e5),
      location: "Lieu à confirmer — EMSI",
      lat: null,
      lng: null,
      status: "PUBLISHED",
      clubId: club.id,
      categoryId: category.id,
    },
    update: {},
  });
  return async () => {
    await prisma.event.delete({ where: { id } }).catch(() => {});
    await prisma.$disconnect();
  };
}

const main = async () => {
  const cleanup = await makeNoVenueEvent();
  const browser = await Browser.launch();
  try {
    await browser.send("Browser.grantPermissions", { origin, permissions: ["geolocation"] });
    const page = await browser.newPage({ width: 1280, height: 900 });
    await page.send("Emulation.setGeolocationOverride", { ...ROUDANI });
    await page.goto(`${origin}/events`);
    await page.eval(`localStorage.removeItem("cp-campus")`);
    await page.goto(`${origin}/events`);
    await sleep(600);

    // 1 — the view group now carries a third, Map, control.
    const views = await page.eval(
      `[...document.querySelectorAll("[data-view]")].map((b) => b.innerText)`
    );
    check(
      "View group carries a third (Map) control",
      views.length === 3 && views.includes("Carte"),
      JSON.stringify(views)
    );

    // getPublishedEvents is wrapped in unstable_cache (revalidate: 60), so a
    // wall rendered before the temp event existed can be served for up to a
    // minute. Poll the grid for the temp card so the assertions below always
    // read a wall that includes it.
    let wallFresh = false;
    for (let i = 0; i < 30; i++) {
      if (await page.eval(`document.body.innerText.includes("partenaire")`)) {
        wallFresh = true;
        break;
      }
      await sleep(3000);
    }
    check("Wall picks up the coordinate-less event", wallFresh, `fresh=${wallFresh}`);

    // 2 — switching to Map renders the field with a pin per coordinate.
    await click(page, '[data-view="map"]');
    await sleep(700);
    const mapShown = await page.eval(`!!document.querySelector("[data-map]")`);
    const pins = await pinCount(page);
    check(
      "Map field renders with one pin per coordinate",
      mapShown && pins === 5,
      `map=${mapShown}, pins=${pins} (5 seeded events carry venue coords)`
    );

    // 3 — nothing is hidden: the coordinate-less event stays listed.
    // innerText reflects CSS text-transform, so the heading renders "HORS
    // CARTE" — match case-insensitively rather than trusting the dict casing.
    const offMap = await page.eval(
      `/hors carte/i.test(document.body.innerText) && document.body.innerText.includes("partenaire")`
    );
    check(
      "Coordinate-less event stays listed under the map",
      offMap,
      offMap ? "listed in the off-map section" : "missing from the off-map section"
    );
    await page.screenshot({ path: `${OUT}/probe-map-desktop.jpg` });

    // 4 — no pin is selected yet: the map opens on its honest hint.
    const hintAtStart = await hintShown(page);
    check("Map opens with its hint, nothing preselected", hintAtStart, `hint=${hintAtStart}`);

    // 5 — clicking a pin selects it and surfaces that event's poster card.
    await click(page, "[data-pin]");
    await sleep(500);
    const cardTitle = await panelTitle(page);
    const pressed = await page.eval(
      `document.querySelector("[data-pin]")?.getAttribute("aria-pressed")`
    );
    check(
      "Clicking a pin shows that event's card, aria-pressed set",
      cardTitle.length > 0 && pressed === "true",
      `card: "${cardTitle.slice(0, 34)}", aria-pressed=${pressed}`
    );
    await page.screenshot({ path: `${OUT}/probe-map-selected.jpg` });

    // 6 — clicking the same pin again releases it.
    await click(page, "[data-pin]");
    await sleep(400);
    const released = await hintShown(page);
    check("Clicking the pin again releases the selection", released, `hint back=${released}`);

    // 7 — filters still narrow the map.
    await page.eval(`(() => {
      const input = document.querySelector('input[type="search"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "minuit");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
    await sleep(900);
    const filteredPins = await pinCount(page);
    check(
      "Search narrows the pins (one match)",
      filteredPins === 1,
      `${filteredPins} pin for "minuit"`
    );
    await page.eval(`(() => {
      const input = document.querySelector('input[type="search"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
    await sleep(900);

    // 8 — the consented position marker appears only after "Near me".
    const hereBefore = await page.eval(`!!document.querySelector("[data-maphere]")`);
    await click(page, "[data-near]");
    await sleep(1400);
    const hereAfter = await page.eval(`!!document.querySelector("[data-maphere]")`);
    check(
      "You-are-here marker gated behind Near me consent",
      !hereBefore && hereAfter,
      `before=${hereBefore}, after=${hereAfter}`
    );
    await page.screenshot({ path: `${OUT}/probe-map-here.jpg` });

    // 9 — Arabic: the map survives RTL, pins keep their projections.
    await page.send("Network.setCookie", {
      name: "cp-locale",
      value: "ar",
      url: origin,
    });
    await page.goto(`${origin}/events`);
    await sleep(600);
    await click(page, '[data-view="map"]');
    await sleep(700);
    const rtl = await page.eval(`document.documentElement.dir`);
    const arPins = await pinCount(page);
    const arLabel = await page.eval(
      `document.querySelector("[data-map]")?.getAttribute("aria-label") ?? ""`
    );
    check(
      "Arabic flips the map to RTL with every pin intact",
      rtl === "rtl" && arPins === 5 && arLabel.includes("خريطة"),
      `dir=${rtl}, pins=${arPins}, label=${arLabel.slice(0, 22)}`
    );
    await page.screenshot({ path: `${OUT}/probe-map-ar.jpg` });

    // 10 — mobile: the map is not clipped and pins stay hit-testable. The AR
    // cookie from step 9 is dropped first so this asserts the LTR layout.
    await page.send("Network.deleteCookies", { name: "cp-locale", url: origin });
    const mobile = await browser.newPage({ width: 390, height: 844 });
    await mobile.send("Emulation.setGeolocationOverride", { ...ROUDANI });
    await mobile.goto(`${origin}/events`);
    await sleep(600);
    await click(mobile, '[data-view="map"]');
    await sleep(700);
    const overflow = await mobile.eval(`(() => {
      const m = document.querySelector("[data-map]");
      const r = m.getBoundingClientRect();
      return { w: Math.round(r.width), scroll: document.documentElement.scrollWidth, view: window.innerWidth };
    })()`);
    const mPins = await pinCount(mobile);
    check(
      "Mobile map fits the viewport, pins intact",
      overflow.scroll <= overflow.view + 1 && mPins === 5,
      `map ${overflow.w}px, scrollWidth=${overflow.scroll}, view=${overflow.view}, pins=${mPins}`
    );
    await mobile.screenshot({ path: `${OUT}/probe-map-mobile.jpg` });
    await mobile.close();

    await page.close();
  } finally {
    await browser.close();
    await cleanup();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nprobe-map: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

await main();
