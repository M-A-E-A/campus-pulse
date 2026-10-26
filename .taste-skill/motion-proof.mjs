// Motion proof for the landing page.
//
// This machine's OS reports prefers-reduced-motion: reduce to every Chrome, so
// the taste-skill inspector (and any headless run) sees the page's static
// variant and its still-page check fails by construction. This probe forces
// prefers-reduced-motion: no-preference via CDP and proves the motion layer:
//   1. the marquee CSS animation runs (name + transform delta over time)
//   2. the hero GSAP entrance moves the hero lines during load
//   3. the Three.js canvas mounts and renders
//   4. the accordion runs a real flex-basis CSSTransition on click
//   5. the events deck pins (ScrollTrigger pin-spacer) at >=1024 and scrubs
// Writes .taste-skill/motion-proof.json + two evidence frames of the marquee.
//
// Usage: CHROME_PATH=... node .taste-skill/motion-proof.mjs [url]
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";
import { writeFileSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3100";
const out = { url, at: new Date().toISOString(), checks: {} };

// Wait for a 200 (DB cold start can 500 the first requests).
for (let i = 0; i < 30; i++) {
  try {
    const r = await fetch(url, { redirect: "manual" });
    if (r.status === 200) break;
  } catch {}
  await sleep(1000);
  if (i === 29) throw new Error("server not ready at " + url);
}

const b = await Browser.launch({ width: 1440, height: 900 });
try {
  const p = await b.newPage({ width: 1440, height: 900 });
  // The whole point: override the OS signal before the page loads.
  await p.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });

  // 2. hero entrance: poll hero-line rects from navigation start.
  const heroSamples = [];
  const heroPoll = setInterval(async () => {
    try {
      heroSamples.push(
        await p.eval(`(() => [...document.querySelectorAll('[data-hero-line]')].map(e => Math.round(e.getBoundingClientRect().top)))()`)
      );
    } catch {}
  }, 100);

  await p.goto(url, { settleMs: 0 });
  await sleep(2500);
  clearInterval(heroPoll);
  let heroMoved = false;
  for (let i = 1; i < heroSamples.length && !heroMoved; i++) {
    const a = heroSamples[i - 1], c = heroSamples[i];
    if (a.length && c.length && a.some((v, k) => Math.abs(v - (c[k] ?? v)) > 4)) heroMoved = true;
  }
  out.checks.heroEntrance = { samples: heroSamples.length, moved: heroMoved };

  out.checks.media = await p.eval(`(() => ({
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
    noPref: matchMedia('(prefers-reduced-motion: no-preference)').matches,
    cores: navigator.hardwareConcurrency,
  }))()`);

  // 1. marquee: animation registry + transform delta over 600ms.
  const animNames = await p.eval(`(() => document.getAnimations().map(a => a.animationName || a.constructor.name))()`);
  const x1 = await p.eval(`(() => Math.round(document.querySelector('.marquee-track').getBoundingClientRect().x))()`);
  await sleep(600);
  const x2 = await p.eval(`(() => Math.round(document.querySelector('.marquee-track').getBoundingClientRect().x))()`);
  out.checks.marquee = { animations: animNames, x1, x2, movedPx: x2 - x1 };

  // 3. canvas: mounts once hydration + the device gate pass.
  const canvas1 = await p.eval(`document.querySelectorAll('canvas').length`);
  await sleep(1500);
  const canvas2 = await p.eval(`document.querySelectorAll('canvas').length`);
  out.checks.canvas = { onLoad: canvas1, afterSettle: canvas2 };

  // evidence frames of the moving band (viewport shots, band scrolled into view)
  await p.eval(`document.querySelector('#clubs .marquee').scrollIntoView({ block: 'center' })`);
  await sleep(400);
  await p.screenshot({ path: ".taste-skill/motion-frame-1.jpg" });
  await sleep(500);
  await p.screenshot({ path: ".taste-skill/motion-frame-2.jpg" });

  // 4. accordion: click stage 2, sample its width across the transition.
  const accSel = "#how-stage-1 button";
  const w0 = await p.eval(`(() => { const el = document.querySelector('#how-stage-1'); return el ? Math.round(el.getBoundingClientRect().width) : -1; })()`);
  await p.eval(`document.querySelector('${accSel}').click()`);
  await sleep(120);
  const w1 = await p.eval(`(() => Math.round(document.querySelector('#how-stage-1').getBoundingClientRect().width))()`);
  await sleep(600);
  const w2 = await p.eval(`(() => Math.round(document.querySelector('#how-stage-1').getBoundingClientRect().width))()`);
  const trans = await p.eval(`(() => document.getAnimations().filter(a => a.constructor.name === 'CSSTransition').length)()`);
  out.checks.accordion = { widthBefore: w0, widthMid: w1, widthAfter: w2, csstransitions: trans, animated: w1 !== w2 };

  // 5. deck: scroll to it; pin-spacer + row translate prove the scrub.
  await p.wheel(2600, { step: 260, pauseMs: 30 });
  await sleep(900);
  await p.wheel(2200, { step: 260, pauseMs: 30 });
  await sleep(1200);
  out.checks.deck = await p.eval(`(() => ({
    pinned: !!document.querySelector('.pin-spacer'),
    rowTransform: getComputedStyle(document.querySelector('.deck-row')).transform,
    scrollY: Math.round(window.scrollY),
  }))()`);

  out.consoleErrors = p.consoleErrors;
} finally {
  await b.close();
}
writeFileSync(".taste-skill/motion-proof.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
