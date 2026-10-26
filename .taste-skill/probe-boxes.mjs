// One-off: which content boxes set canvas.left / canvas.right in probe.mjs?
// Usage: node .taste-skill/probe-boxes.mjs <url> [width] [height]
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const url = process.argv[2] || "http://localhost:3100/admin";
const width = Number(process.argv[3] || 1440);
const height = Number(process.argv[4] || 900);
const origin = new URL(url).origin;

async function login(email) {
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
      email,
      password: "password123",
      callbackUrl: `${origin}/login`,
    }),
  });
  grab(res);
  return { name: "authjs.session-token", value: jar.get("authjs.session-token") };
}

// Pass "anon" as the 5th arg to measure a signed-out page (the login screen
// shows a different nav — and a different rightmost box — once authenticated).
const who = process.argv[5] || "admin@campus.ma";
const session = who === "anon" ? null : await login(who);
const browser = await Browser.launch();
try {
  const page = await browser.newPage({ width, height, dsf: 1 });
  if (session) {
    await page.send("Network.setCookie", { name: session.name, value: session.value, url: origin });
  }
  await page.goto(url, { timeoutMs: 30000, settleMs: 800 });
  await sleep(1500);

  const out = await page.eval(`(() => {
    const B = document.body, W = innerWidth;
    const sel = (el) => {
      if (!el || !el.tagName) return String(el);
      let s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      if (el.className && typeof el.className === 'string')
        s += '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.');
      return s;
    };
    const shown = (el) => { const c = getComputedStyle(el);
      return c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity >= 0.05; };

    const boxes = [];
    const tw = document.createTreeWalker(B, NodeFilter.SHOW_TEXT);
    const trg = document.createRange();
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.nodeValue.trim() || !n.parentElement || n.parentElement.closest('svg')) continue;
      const cs = getComputedStyle(n.parentElement);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05) continue;
      trg.selectNodeContents(n);
      const r = trg.getBoundingClientRect();
      if (r.width < 2 || (cs.position === 'fixed' && r.left > W * 0.5)) continue;
      boxes.push({ kind: 'text', left: r.left, right: r.right, sel: sel(n.parentElement),
                   snippet: n.nodeValue.trim().slice(0, 40) });
    }
    for (const el of B.querySelectorAll('svg, canvas, img, video, input, select, textarea, button, table')) {
      if (el.parentElement && el.parentElement.closest('svg')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || !shown(el)) continue;
      boxes.push({ kind: el.tagName.toLowerCase(), left: r.left, right: r.right, sel: sel(el),
                   snippet: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40) });
    }
    boxes.sort((a, b) => a.left - b.left);
    const lefts = boxes.map(b => b.left), rights = boxes.map(b => b.right).sort((a,b)=>a-b);
    const n = boxes.length;
    const iL = Math.floor(n * 0.02), iR = Math.floor(n * 0.98);
    return {
      count: n,
      pctLeft: Math.round(lefts.slice().sort((a,b)=>a-b)[iL]),
      pctRightGap: Math.round(W - rights[iR]),
      leftmost: boxes.slice(0, 6),
      rightmost: boxes.slice().sort((a,b)=>b.right-a.right).slice(0, 4),
    };
  })()`);
  console.log(JSON.stringify(out, null, 1));
} finally {
  await browser.close();
}
