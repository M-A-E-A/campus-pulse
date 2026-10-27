/**
 * Judge the notification bell itself: badge, panel contents, computed poster
 * styles, Escape dismissal — then photograph it open on desktop and mobile.
 *
 * Usage: node .taste-skill/shot-bell.mjs   (server on :3100, staged rows first)
 */
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const OUT = ".taste-skill";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

// --- session, the same hand-rolled jar as scripts/inspect-auth.mjs ---------
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
if (!token) throw new Error(`login failed (status ${res.status}, location ${res.headers.get("location")})`);

const browser = await Browser.launch();
try {
  // ---------------- desktop ------------------------------------------------
  const page = await browser.newPage({ width: 1440, height: 900, dsf: 1 });
  await page.send("Network.setCookie", { name: "authjs.session-token", value: token, url: origin });
  await page.goto(`${origin}/dashboard`, { timeoutMs: 30000, settleMs: 800 });
  await sleep(700);

  const badge = await page.eval(`(document.querySelector('[aria-controls="notif-panel"] span[aria-hidden="true"]')?.textContent || "").trim()`);
  check("unread badge shows the count", badge === "3", `badge=${JSON.stringify(badge)}`);

  const label = await page.eval(`document.querySelector('[aria-controls="notif-panel"]')?.getAttribute("aria-label") || ""`);
  check("accessible name carries the count", /3/.test(label) && label.length > 5, `aria-label=${JSON.stringify(label)}`);

  // open the panel
  await page.eval(`document.querySelector('[aria-controls="notif-panel"]').click()`);
  await sleep(350);
  const opened = await page.eval(`!!document.getElementById("notif-panel")`);
  check("click opens the panel", opened, `panel present=${opened}`);

  const info = await page.eval(`(() => {
    const p = document.getElementById("notif-panel");
    if (!p) return null;
    const items = [...p.querySelectorAll("li")].map((li) => ({
      text: li.innerText.replace(/\\s*\\n\\s*/g, " | ").trim(),
      unread: !!li.querySelector("span.sr-only"),
      tag: li.firstElementChild?.tagName || "",
    }));
    const cs = getComputedStyle(p);
    const btn = document.querySelector('[aria-controls="notif-panel"]');
    return {
      header: p.firstElementChild?.innerText.replace(/\\s*\\n\\s*/g, " ").trim() || "",
      expanded: btn.getAttribute("aria-expanded"),
      items,
      style: {
        border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor,
        radius: cs.borderTopLeftRadius,
        shadow: cs.boxShadow,
        bg: cs.backgroundColor,
      },
      // nothing overflows the viewport horizontally
      rect: p.getBoundingClientRect().toJSON(),
    };
  })()`);

  check("panel opens as an expanded disclosure", info?.expanded === "true", `aria-expanded=${info?.expanded}`);
  check("all five rows render", info?.items.length === 5, `rows=${info?.items.length}`);
  check("header + mark-all row", /Notifications/i.test(info?.header || ""), `header=${JSON.stringify(info?.header)}`);
  const unreadRows = (info?.items || []).filter((i) => i.unread).length;
  check("three rows marked unread", unreadRows === 3, `unread=${unreadRows}`);
  check(
    "poster framing: 2px solid rule, square corners, flat offset shadow",
    info?.style.border?.startsWith("2px solid") && info?.style.radius === "0px" && (info?.style.shadow || "").includes("rgb"),
    `border=${info?.style.border} radius=${info?.style.radius} shadow=${info?.style.shadow}`
  );
  check(
    "panel fits inside the viewport",
    info && info.rect.right <= 1440 && info.rect.left >= 0,
    `left=${Math.round(info?.rect.left)} right=${Math.round(info?.rect.right)}`
  );

  console.log("\nmessages rendered (fr):");
  for (const it of info?.items || []) console.log(`  [${it.unread ? "new" : "read"}] ${it.text}`);
  await page.screenshot({ path: `${OUT}/bell-open-desktop.jpg`, quality: 85 });

  // Escape closes it and returns focus to the trigger (disclosure pattern)
  await page.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
  await sleep(300);
  const afterEsc = await page.eval(`({
    panelGone: !document.getElementById("notif-panel"),
    focusBack: document.activeElement === document.querySelector('[aria-controls="notif-panel"]'),
    collapsed: document.querySelector('[aria-controls="notif-panel"]').getAttribute("aria-expanded"),
  })`);
  check(
    "Escape closes and refocuses the trigger",
    afterEsc.panelGone && afterEsc.focusBack && afterEsc.collapsed === "false",
    JSON.stringify(afterEsc)
  );
  await page.close();

  // ---------------- mobile -------------------------------------------------
  const m = await browser.newPage({ width: 390, height: 844, dsf: 1, mobile: true });
  await m.send("Network.setCookie", { name: "authjs.session-token", value: token, url: origin });
  await m.goto(`${origin}/dashboard`, { timeoutMs: 30000, settleMs: 800 });
  await sleep(700);
  await m.eval(`document.querySelector('[aria-controls="notif-panel"]').click()`);
  await sleep(350);
  const mrect = await m.eval(`(() => {
    const p = document.getElementById("notif-panel");
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width, vw: innerWidth };
  })()`);
  check(
    "mobile panel fits 390px",
    mrect && mrect.left >= 0 && mrect.right <= mrect.vw,
    `left=${mrect ? Math.round(mrect.left) : "-"} right=${mrect ? Math.round(mrect.right) : "-"} vw=${mrect?.vw}`
  );
  await m.screenshot({ path: `${OUT}/bell-open-mobile.jpg`, quality: 85 });
  await m.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\nTOTAL: ${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
