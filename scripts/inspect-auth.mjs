/**
 * Judge an AUTHENTICATED app screen with the design-taste-frontend rules.
 *
 * WHY THIS EXISTS
 * `inspect.mjs` has no login option, so every protected screen (dashboard,
 * organizer, admin) gets judged as its 307 redirect to /login. Rather than
 * edit the detector — which would be a way of weakening the gate — this wrapper
 * supplies the one thing it cannot: a session. Every rule, threshold, allowance
 * and measurement comes straight from the skill's own libraries, imported
 * unmodified:
 *
 *   ./lib/probe.mjs   -> probe, frame, layout, app, colourShare
 *   ./lib/rules.mjs   -> judge, judgeLayout, judgeApp, APP_SKIP
 *   ./inspect.mjs     -> MOTION_RECORDER, read out of the file at runtime so
 *                        this wrapper always measures motion with the
 *                        detector's own instrument and cannot drift from it
 *
 * It reproduces inspect.mjs's `--app` path in the detector's own order:
 *   judge -> font-not-dealt -> judgeLayout -> filter(APP_SKIP, no-title,
 *   small-title) -> judgeApp -> the scroll checks (covered-text, clipped-text,
 *   pinned-over-picture, long-pin, still-page, empty-screens).
 * Note those last six are pushed AFTER the APP_SKIP filter in inspect.mjs, so
 * still-page and empty-screens are evaluated on app screens too — deliberately
 * reproduced here rather than quietly dropped, even though the project brief
 * keeps dashboards animation-free. If it fires, that is a real conflict to
 * report, not to hide.
 *
 * Differences from inspect.mjs (output only, never judgement): contact sheets
 * are replaced by full-size scroll frames so a dashboard can be judged at 1:1,
 * and the file-path / local-server branch is not supported (this judges a live
 * URL).
 *
 * USAGE
 *   node scripts/inspect-auth.mjs <url> [--email ..] [--password ..]
 *                                 [--allow rule,rule] [--widths 1440,768,390]
 *                                 [--out .taste-skill/inspect-auth]
 */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";
import { probe, frame, layout, app, colourShare } from "../.agents/skills/design-taste-frontend/scripts/lib/probe.mjs";
import { judge, judgeLayout, judgeApp, APP_SKIP } from "../.agents/skills/design-taste-frontend/scripts/lib/rules.mjs";

const SKILL_SCRIPTS = resolve(".agents/skills/design-taste-frontend/scripts");

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf("--" + n);
  if (i === -1) return d;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};

const url = args[0];
if (!url || url.startsWith("-") || !/^https?:\/\//.test(url)) {
  console.error("usage: node scripts/inspect-auth.mjs <url> [--email a@b.c] [--password p] [--allow a,b] [--widths 1440,768,390] [--out DIR]");
  process.exit(2);
}
const origin = new URL(url).origin;
const email = flag("email", "student@campus.ma");
const password = flag("password", "password123");
const widths = flag("widths", "1440,768,390").split(",").map(Number).filter(Boolean);
const outDir = resolve(flag("out", ".taste-skill/inspect-auth"));
const HEIGHT = { 1440: 900, 1280: 800, 1024: 768, 768: 1024, 390: 844, 375: 812 };
const labelFor = (w) => (w >= 1100 ? "desktop" : w >= 600 ? "tablet" : "mobile");
const rel = (p) => relative(process.cwd(), p).split("\\").join("/");

// ---------------------------------------------------------------------------
// 1. allowances + dealt fonts, read exactly the way inspect.mjs reads them
//    (CLI --allow, then .taste-skill/direction.json merged over it).
// ---------------------------------------------------------------------------
let allow = flag("allow", "").split(",").filter(Boolean);
let dealtFonts = [];
for (const p of [".taste-skill/direction.json", join(outDir, "..", "direction.json")]) {
  if (!existsSync(p)) continue;
  try {
    const d = JSON.parse(readFileSync(p, "utf8"));
    allow = [...new Set([...allow, ...(d.allow || [])])];
    dealtFonts = (d.input?.keep || []).includes("type")
      ? []
      : d.kind === "app"
        ? [d.style?.tokens?.font?.family].filter(Boolean)
        : [d.type?.display?.family, d.type?.text?.family].filter(Boolean);
  } catch {}
  break;
}

// ---------------------------------------------------------------------------
// 2. the detector's motion recorder, extracted from inspect.mjs at runtime so
//    this wrapper can never measure motion with anything but its own instrument.
// ---------------------------------------------------------------------------
const MOTION_RECORDER = (() => {
  const src = readFileSync(join(SKILL_SCRIPTS, "inspect.mjs"), "utf8");
  const m = src.match(/const MOTION_RECORDER = `([\s\S]*?)`;/);
  if (!m) throw new Error("could not extract MOTION_RECORDER from inspect.mjs — the detector changed shape; re-check this wrapper against it");
  return m[1];
})();

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) {
  if (/^(desktop|tablet|mobile)-(fold|screen-\d+)\.jpg$/.test(f)) unlinkSync(join(outDir, f));
}

// ---------------------------------------------------------------------------
// 3. a session, obtained over HTTP the way a browser would (CSRF cookie and
//    token have to travel together, so the jar is carried by hand: Node's
//    fetch does not keep one).
// ---------------------------------------------------------------------------
async function login() {
  const jar = new Map();
  const grab = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1));
    }
  };
  const csrfRes = await fetch(`${origin}/api/auth/csrf`);
  grab(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const cookieHeader = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(`${origin}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader,
      origin,
      referer: `${origin}/login`,
    },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${origin}/login` }),
  });
  grab(res);
  const value = jar.get("authjs.session-token");
  if (!value) throw new Error(`login did not set authjs.session-token (status ${res.status}) — check the credentials or that the server is up`);
  return { name: "authjs.session-token", value };
}

const session = await login();
console.log(`logged in as ${email}`);

// ---------------------------------------------------------------------------
// 4. run the skill's own judges against the authenticated page.
// ---------------------------------------------------------------------------
const report = { url, at: new Date().toISOString(), allow, dealtFonts, viewports: [], findings: [], images: [] };
const browser = await Browser.launch();
const helper = await browser.newPage({ width: 1600, height: 1000, dsf: 1 });

try {
  for (const w of widths) {
    const h = HEIGHT[w] || Math.round(w * 0.625);
    const lab = labelFor(w);
    const page = await browser.newPage({ width: w, height: h, dsf: 1, mobile: w < 600 });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: MOTION_RECORDER }).catch(() => {});
    await page.send("Network.setCookie", { name: session.name, value: session.value, url: origin }).catch(() => {});

    const how = await page.goto(url, { timeoutMs: 30000, settleMs: 600 });
    await sleep(600);
    // Guard against silently judging the login redirect instead of the page.
    const at = await page.eval("location.pathname").catch(() => "");
    if (at.includes("/login")) throw new Error("redirected to /login — the session did not stick");
    await page.eval("document.fonts.ready.then(() => true)").catch(() => {});
    await sleep(800);

    const fold = join(outDir, `${lab}-fold.jpg`);
    await page.screenshot({ path: fold, quality: 82 });
    const metrics = await page.eval(probe);

    // walk the page one screen at a time so scroll reveals fire, photographing each screen
    const frames = [readFileSync(fold).toString("base64")];
    const frameChecks = [await page.eval(frame).catch(() => null)];
    const screens = Math.min(11, Math.max(0, Math.ceil(metrics.page.height / h) - 1));
    for (let i = 1; i <= screens; i++) {
      await page.eval(`window.scrollTo({ top: ${i * h}, behavior: "instant" })`).catch(() => {});
      await page.wheel(2);
      await sleep(650);
      frames.push(await page.screenshot({ quality: 78 }));
      frameChecks.push(await page.eval(frame).catch(() => null));
      await page.eval("window.__motionSample && window.__motionSample()").catch(() => {});
    }
    const motion = await page.eval("window.__motion ? window.__motion() : null").catch(() => null);

    // re-measure after everything has revealed (catches content that only exists post-reveal)
    await page.eval('window.scrollTo({ top: 0, behavior: "instant" })').catch(() => {});
    await sleep(350);
    const after = await page.eval(probe).catch(() => metrics);
    const m = after.headings.length >= metrics.headings.length ? after : metrics;
    const lay = await page.eval(layout).catch(() => null);
    const appM = await page.eval(app).catch(() => null);
    if (appM) appM.colourShare = await helper.eval(colourShare, "data:image/jpeg;base64," + frames[0]).catch(() => null);

    const pages = [];
    frames.forEach((b64, i) => {
      const p = join(outDir, `${lab}-screen-${String(i).padStart(2, "0")}.jpg`);
      writeFileSync(p, Buffer.from(b64, "base64"));
      pages.push(p);
    });
    report.images.push({ viewport: lab, width: w, fold, pages });

    // ---- the detector's app path, in its own order ------------------------
    let vf = [...judge(m, { width: w, allow })];

    if (dealtFonts.length && w >= 1100 && !allow.includes("font-not-dealt")) {
      const norm = (f) => String(f).toLowerCase().replace(/["']/g, "").replace(/\s+variable$/, "").trim();
      const used = m.type.families.filter((f) => f.share >= 0.1).map((f) => norm(f.family));
      const missing = dealtFonts.filter((f) => !used.some((u) => u === norm(f) || u.startsWith(norm(f))));
      if (missing.length === dealtFonts.length) {
        vf.push({
          level: "FAIL",
          id: "font-not-dealt",
          width: w,
          message: `The sheet dealt ${dealtFonts.join(" and ")}, but the page renders ${m.type.families.slice(0, 2).map((f) => f.family).join(", ")}.`,
          fix: "Load the dealt face (the link on the sheet) and put it first in font-family. A build that falls back to a default face lands on the default look.",
        });
      }
    }

    if (lay) vf.push(...judgeLayout(lay, { width: w, allow }));
    vf = vf.filter((f) => !APP_SKIP.has(f.id) && f.id !== "no-title" && f.id !== "small-title");
    if (appM) vf.push(...judgeApp(appM, m, { width: w, allow }));

    // what only shows up while scrolling
    const coveredText = [...new Map(frameChecks.filter(Boolean).flatMap((f, i) => f.covered.map((c) => [c.text, { ...c, screen: i + 1 }]))).values()];
    if (coveredText.length && !allow.includes("covered-text")) {
      vf.push({
        level: "FAIL", id: "covered-text", width: w,
        message: `Large text lies under another element at some scroll position: ` + coveredText.slice(0, 4).map((c) => `"${c.text}" (screen ${c.screen}, ${Math.round(c.share * 100)}% hidden)`).join("; "),
        fix: "Nothing may sit on top of a headline or statement. Move the picture, shorten the pinned run, or raise the text above it (z-index) and give it a ground.",
      });
    }
    const clippedText = [...new Map(frameChecks.filter(Boolean).flatMap((f, i) => (f.clipped || []).map((c) => [c.text, { ...c, screen: i + 1 }]))).values()];
    if (clippedText.length && !allow.includes("clipped-text")) {
      vf.push({
        level: "FAIL", id: "clipped-text", width: w,
        message: "Large text is cut off along its top by the box that holds it: " + clippedText.slice(0, 3).map((c) => `"${c.text}" (screen ${c.screen})`).join("; "),
        fix: "Jurors read a wordmark sliced at the top as broken. Give the box room for the ascenders (line-height and padding), or crop at the bottom or a side edge on purpose.",
      });
    }
    const overPictures = [...new Map(frameChecks.filter(Boolean).flatMap((f, i) => (f.pinnedOver || []).map((c) => [c.text, { ...c, screen: i + 1 }]))).values()];
    if (overPictures.length && !allow.includes("pinned-over-picture")) {
      vf.push({
        level: "WARN", id: "pinned-over-picture", width: w,
        message: "Pinned large text slides across pictures while the page scrolls: " + overPictures.slice(0, 3).map((c) => `"${c.text}" (screen ${c.screen}, ${Math.round(c.share * 100)}% over a picture)`).join("; "),
        fix: "Jurors read a pinned title crossing drawings or photographs as a collision. Keep the pictures in the column the title does not occupy, or unpin it.",
      });
    }
    const empty = frameChecks.map((f, i) => ({ f, i })).filter(({ f }) => f && f.filled < 0.2);
    const runs = new Map();
    frameChecks.forEach((f, i) => {
      for (const t of f?.big || []) {
        const r = runs.get(t) || { start: i, last: i - 1, best: 0 };
        if (r.last === i - 1) r.last = i; else { r.start = i; r.last = i; }
        r.best = Math.max(r.best, r.last - r.start + 1);
        runs.set(t, r);
      }
    });
    const longPins = [...runs.entries()].filter(([, r]) => r.best >= 3);
    if (w >= 1100 && longPins.length && !allow.includes("long-pin")) {
      vf.push({
        level: "WARN", id: "long-pin", width: w,
        message: `The same large text stays on screen for ${Math.max(...longPins.map(([, r]) => r.best))} screens in a row: ` + longPins.slice(0, 2).map(([t]) => `"${t}"`).join("; "),
        fix: "A pinned element earns two screens, and something must change at each. Shorten the run or give every screen its own content.",
      });
    }
    // a page that barely moves: counted from what really animated while it loaded and was scrolled
    if (w >= 1100 && motion && !allow.includes("still-page")) {
      const moving = motion.elements + motion.playingVideos * 4;
      if (moving < 8) {
        vf.push({
          level: "FAIL", id: "still-page", width: w,
          message: `Only ${motion.elements} element(s) moved while the page loaded and scrolled${motion.playingVideos ? ` (plus ${motion.playingVideos} playing video)` : ""}.`,
          fix: "Build the motion layer (SKILL.md step 9, references/motion.md): the signature move, an entrance for the parts of every section, feedback on every control, and one moving picture. Transform and opacity only, with a reduced-motion fallback.",
        });
      } else if (moving < 16) {
        vf.push({
          level: "WARN", id: "still-page", width: w,
          message: `Little motion: ${motion.elements} element(s) moved while the page loaded and scrolled.`,
          fix: "Give every section an entrance for its parts (not one fade of the whole block) and add one moving picture: a looping clip or a slow move on a photograph.",
        });
      }
    }
    if (w >= 1100 && empty.length >= 2 && !allow.includes("empty-screens")) {
      vf.push({
        level: "FAIL", id: "empty-screens", width: w,
        message: `${empty.length} of ${frameChecks.length} desktop screens are almost empty ground (under 20% of the screen holds text, a picture or a colour field): screens ${empty.map(({ i }) => i + 1).join(", ")}.`,
        fix: "An empty screen is a rest only once per page. Elsewhere it means the section is underbuilt: set its content larger, give it the full information, put it on a colour field, or cut it.",
      });
    }

    report.findings.push(...vf);
    report.viewports.push({
      width: w, height: h, load: how, screens: frames.length, motion,
      filled: frameChecks.map((f) => f?.filled ?? null),
      metrics: m, layout: lay, app: appM, consoleErrors: page.consoleErrors.slice(0, 5),
    });
    await page.close();
  }
} finally {
  await helper.close().catch(() => {});
  await browser.close();
}

// de-duplicate findings that repeat across viewports (keep the widest, note the rest)
const merged = [];
for (const f of report.findings) {
  const same = merged.find((x) => x.id === f.id && x.level === f.level);
  if (same && f.id !== "headline-lines" && f.id !== "overflow") {
    same.alsoAt = [...(same.alsoAt || []), f.width];
    continue;
  }
  merged.push(f);
}
report.findings = merged;
writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 1));

const d = report.viewports[0].metrics;
const line = (s = "") => console.log(s);
line(`APP INSPECT (authenticated)  ${report.url}`);
line("");
line("MEASURED (first viewport listed)");
if (d.hero) line(`  hero headline   "${d.hero.text.slice(0, 70)}"  ${d.hero.words} words -> ${d.hero.lines} line(s) -> ${d.hero.size}px`);
line(`  typefaces       ${d.type.families.filter((f) => f.share >= 0.02).map((f) => `${f.family} ${Math.round(f.share * 100)}%`).join(", ")}`);
line(`  sizes in use    ${d.type.sizes.join(" / ")} px${d.type.body ? `   body ${d.type.body.size}px / ${d.type.body.leading}` : ""}`);
line(`  colour          page ${d.color.bodyBg}${d.color.sectionBgs.length ? "  -> sections " + d.color.sectionBgs.map((s) => s.color).slice(0, 6).join(" ") : ""}${d.color.button ? "  -> button " + d.color.button.bg : ""}`);
line(`  page            ${d.page.screens} screens -> ${d.page.words} words -> ${d.page.img} images`);
for (const v of report.viewports) line(`  @${v.width}px       h1 "${(v.metrics.headings.find((x) => x.tag === "h1")?.text || "").slice(0, 50)}"  motion ${v.motion ? v.motion.elements + " elements moved" : "not recorded"}`);
line("");

const fails = merged.filter((f) => f.level === "FAIL");
const warns = merged.filter((f) => f.level === "WARN");
if (!fails.length && !warns.length) line("FINDINGS  none. Measurements are clean — now judge the pictures.");
for (const [title, list] of [["FAIL — fix every one of these", fails], ["WARN — fix, or be able to defend", warns]]) {
  if (!list.length) continue;
  line(title);
  for (const f of list) {
    line(`  [${f.id}] @${f.width}px${f.alsoAt ? " (+" + f.alsoAt.join(", ") + ")" : ""}  ${f.message}`);
    line(`      -> ${f.fix}`);
  }
  line("");
}
line("LOOK AT THE RENDER — open these before saying anything about quality:");
for (const im of report.images) {
  line(`  ${(im.viewport + " " + im.width + "px").padEnd(15)} ${rel(im.fold)}`);
  for (const p of im.pages) line(`  ${"".padEnd(15)} ${rel(p)}`);
}
line("");
line(`report: ${rel(join(outDir, "report.json"))}`);
line(fails.length ? `RESULT: ${fails.length} FAIL, ${warns.length} WARN — not done.` : `RESULT: 0 FAIL, ${warns.length} WARN — measurements pass. Passing the meter is the floor, not the grade: score the screenshots.`);
process.exit(fails.length ? 1 : 0);
