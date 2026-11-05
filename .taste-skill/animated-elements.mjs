/**
 * Which elements does the inspector count as "moving" on the dashboard?
 * One-shot entrance animations still running at capture time explain the
 * 0..11 jitter; this names them so we can prove they pre-date Phase 2.
 * Usage: CHROME_PATH=.. node .taste-skill/animated-elements.mjs
 */
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const jar = new Map();
const grab = (r) => {
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    const i = p.indexOf("=");
    if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1));
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
    email: "student@campus.ma",
    password: "password123",
    callbackUrl: `${origin}/login`,
  }),
});
grab(res);
const token = jar.get("authjs.session-token");
if (!token) throw new Error("login failed");

const browser = await Browser.launch();
try {
  const page = await browser.newPage({ width: 1440, height: 900, dsf: 1 });
  await page.send("Network.setCookie", { name: "authjs.session-token", value: token, url: origin });
  // Sample immediately after load (the inspector's capture window).
  await page.goto(`${origin}/dashboard`, { timeoutMs: 30000, settleMs: 100 });
  const animated = await page.eval(`[...document.querySelectorAll("*")]
    .filter((el) => {
      const cs = getComputedStyle(el);
      return cs.animationName !== "none" || cs.transitionDuration.split(",").some((d) => parseFloat(d) > 0);
    })
    .slice(0, 40)
    .map((el) => {
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 70),
        anim: cs.animationName,
        animDur: cs.animationDuration,
        trans: cs.transitionDuration,
      };
    })`);
  console.log(JSON.stringify(animated, null, 1));
} finally {
  await browser.close();
}
