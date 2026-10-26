// One-off probe: what is actually animating on a given authenticated page?
// Usage: node .taste-skill/debug-anim.mjs <url> [width] [height]
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const url = process.argv[2] || "http://localhost:3100/organizer";
const width = Number(process.argv[3] || 768);
const height = Number(process.argv[4] || 1024);
const origin = new URL(url).origin;

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
  const res = await fetch(`${origin}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      origin,
      referer: `${origin}/login`,
    },
    body: new URLSearchParams({
      csrfToken,
      email: "organiser@campus.ma",
      password: "password123",
      callbackUrl: `${origin}/login`,
    }),
  });
  grab(res);
  return { name: "authjs.session-token", value: jar.get("authjs.session-token") };
}

const session = await login();

// Record animationstart as it happens (steady-state getAnimations() misses
// finite animations that have already finished) and keep the target.
const RECORDER = `(() => {
  window.__animLog = [];
  const sel = (el) => {
    if (!el || !el.tagName) return String(el);
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string')
      s += '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.');
    return s;
  };
  addEventListener('animationstart', (e) => {
    window.__animLog.push({
      name: e.animationName,
      target: sel(e.target),
      duration: getComputedStyle(e.target).animationDuration,
    });
  }, true);
})();`;

const browser = await Browser.launch();
try {
  const page = await browser.newPage({ width, height, dsf: 1, mobile: width < 600 });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: RECORDER });
  await page.send("Network.setCookie", { name: session.name, value: session.value, url: origin });
  await page.goto(url, { timeoutMs: 30000, settleMs: 600 });
  await sleep(2500);
  await page.eval("window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' })").catch(() => {});
  await sleep(1200);

  const report = await page.eval(`(() => {
    const log = window.__animLog || [];
    const byName = {};
    for (const e of log) {
      const k = e.name + ' (' + e.duration + ')';
      byName[k] = byName[k] || { count: 0, sample: [] };
      byName[k].count++;
      if (byName[k].sample.length < 5 && !byName[k].sample.includes(e.target))
        byName[k].sample.push(e.target);
    }
    return { path: location.pathname, recorderPresent: typeof window.__animLog !== 'undefined', events: log.length, byName };
  })()`);
  console.log(JSON.stringify(report, null, 1));
} finally {
  await browser.close();
}
