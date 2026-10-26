// One-off: screenshot a route in a given locale (the inspector always derives
// Accept-Language=fr, so RTL has to be set through the switcher's own cookie).
// Usage: node .taste-skill/shot-locale.mjs <url> <out.jpg> [locale]
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const url = process.argv[2];
const out = process.argv[3];
const locale = process.argv[4] || "ar";

const browser = await Browser.launch();
try {
  const page = await browser.newPage({ width: 1440, height: 900, dsf: 1 });
  await page.send("Network.setCookie", { name: "cp-locale", value: locale, url: new URL(url).origin });
  await page.goto(url, { timeoutMs: 30000, settleMs: 1000 });
  await sleep(1500);
  await page.screenshot({ path: out, format: "jpeg", quality: 80 });
  const meta = await page.eval(`(() => ({
    dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
    lang: document.documentElement.lang,
    h1: (document.querySelector('h1') || {}).innerText || '',
    panelLeft: (() => { const a = document.querySelector('aside');
      if (!a) return null; const r = a.getBoundingClientRect();
      return Math.round(r.left) + '..' + Math.round(r.right); })(),
    formLeft: (() => { const f = document.querySelector('h1');
      if (!f) return null; const r = f.getBoundingClientRect(); return Math.round(r.left); })(),
  }))()`);
  console.log(JSON.stringify({ ...meta, out }));
} finally {
  await browser.close();
}
