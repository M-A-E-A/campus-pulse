/**
 * PWA end-to-end in a real headless Chromium (CDP), against the PROD build:
 *
 *   1. /sw.js registers, activates and takes control of the page (the
 *      registration lives in a prod-only component, so this also proves it
 *      actually ran),
 *   2. with the network emulated offline for BOTH the page and the service
 *      worker, a navigation still resolves — to the precached trilingual
 *      offline page, at the original URL,
 *   3. the bell panel's push switch, clicked for real, obtains permission,
 *      subscribes through pushManager and persists the row,
 *   4. scripts/push-dispatch.ts then sends a real encrypted push to that
 *      exact browser (201 from the push service), stamps pushedAt, and a
 *      second dispatch sends nothing,
 *   5. turning the switch back off returns it to the enable state.
 *
 * Usage: node scripts/probe-pwa.mjs   (prod server on :3100)
 */
import { spawn } from "node:child_process";
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
if (!token) throw new Error(`login failed (status ${res.status})`);

/** Run the server half while this browser (and its subscription) is alive. */
function runTsx(args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--import", "tsx", ...args]);
    let out = "";
    let err = "";
    const kill = setTimeout(() => p.kill(), 120000);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => {
      clearTimeout(kill);
      resolve({ code: -1, out, err: String(e) });
    });
    p.on("close", (code) => {
      clearTimeout(kill);
      resolve({ code, out, err });
    });
  });
}

const browser = await Browser.launch();
try {
  const page = await browser.newPage({ width: 1440, height: 900, dsf: 1 });
  await page.send("Network.setCookie", { name: "authjs.session-token", value: token, url: origin });
  await page.goto(`${origin}/dashboard`, { timeoutMs: 30000, settleMs: 900 });

  // ---- 1. service worker -------------------------------------------------
  let reg = null;
  for (let i = 0; i < 40 && !reg; i++) {
    reg = await page
      .eval(`(async () => {
        const r = await navigator.serviceWorker.getRegistration();
        return r && r.active ? { script: r.active.scriptURL, state: r.active.state } : null;
      })()`)
      .catch(() => null);
    if (!reg) await sleep(250);
  }
  check(
    "service worker registers and activates",
    !!reg && /\/sw\.js$/.test(reg.script || ""),
    reg ? `${reg.script} (${reg.state})` : "no active registration after 10s"
  );

  let controller = null;
  for (let i = 0; i < 24 && !controller; i++) {
    controller = await page
      .eval(`navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null`)
      .catch(() => null);
    if (!controller) await sleep(250);
  }
  check(
    "the active worker controls the page",
    !!controller,
    controller || "controller still null — claim() did not take"
  );

  // ---- 2. offline fallback ----------------------------------------------
  // Emulate offline on BOTH network contexts: the page session (for the
  // fetch probe below) and the service worker session (the navigation
  // fallback itself runs inside the SW, whose target is separate).
  await page.send("Network.enable");
  let swSession = null;
  try {
    const targets = await browser.send("Target.getTargets");
    const sw = (targets.targetInfos || []).find(
      (t) => t.type === "service_worker" && t.url.startsWith(origin)
    );
    if (sw) {
      const attached = await browser.send("Target.attachToTarget", {
        targetId: sw.targetId,
        flatten: true,
      });
      swSession = attached.sessionId;
      await browser.send("Network.enable", {}, swSession);
    }
  } catch {
    swSession = null; // fall through: page-side emulation alone may still be enough
  }

  const setOffline = (offline) => {
    const params = offline
      ? { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }
      : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
    return Promise.all([
      page.send("Network.emulateNetworkConditions", params),
      swSession ? browser.send("Network.emulateNetworkConditions", params, swSession) : Promise.resolve(),
    ]);
  };

  await setOffline(true);
  const fetchProbe = await page.eval(
    `fetch("/api/push/public-key").then((r) => "status:" + r.status).catch((e) => "ERR")`
  );
  check(
    "emulated offline really cuts the network",
    String(fetchProbe).startsWith("ERR"),
    `probe fetch -> ${fetchProbe}${swSession ? "" : " (no SW target found to emulate)"}`
  );

  let offlineInfo;
  try {
    await page.goto(`${origin}/dashboard`, { timeoutMs: 15000, settleMs: 700 });
    offlineInfo = await page.eval(`({
      path: location.pathname,
      title: document.title,
      body: (document.body && document.body.innerText || "").slice(0, 200),
    })`);
  } catch (e) {
    offlineInfo = { path: "(navigation failed)", title: "", body: e.message };
  }
  check(
    "offline navigation lands on the precached offline page",
    offlineInfo.path === "/dashboard" &&
      /hors connexion|You're offline|غير متصل/i.test(`${offlineInfo.title} ${offlineInfo.body}`),
    `path=${offlineInfo.path} title=${JSON.stringify(offlineInfo.title)} body=${JSON.stringify(
      String(offlineInfo.body).slice(0, 70)
    )}`
  );

  await setOffline(false);
  await page.goto(`${origin}/dashboard`, { timeoutMs: 30000, settleMs: 900 });

  // ---- 3. permission, then the real toggle -------------------------------
  let grantErr = null;
  try {
    await browser.send("Browser.grantPermissions", { permissions: ["notifications"], origin });
  } catch (e) {
    grantErr = e.message;
  }
  await sleep(400);
  let perm = await page.eval(`Notification.permission`);
  if (perm !== "granted" && !grantErr) {
    // A renderer that loaded before the grant can serve a cached value —
    // reload once before declaring it unavailable.
    await page.goto(`${origin}/dashboard`, { timeoutMs: 30000, settleMs: 900 });
    perm = await page.eval(`Notification.permission`);
  }
  check(
    "notifications permission granted for the origin",
    perm === "granted",
    grantErr ? `Browser.grantPermissions failed: ${grantErr}` : `Notification.permission=${perm}`
  );

  const footerText = () =>
    page.eval(`(() => {
      const panel = document.getElementById("notif-panel");
      const footer = panel && panel.querySelector(":scope > div:last-child");
      return footer ? (footer.innerText || "").trim().replace(/\\s+/g, " ") : "";
    })()`);

  await page.eval(`document.querySelector('[aria-controls="notif-panel"]').click()`);
  let offer = null;
  for (let i = 0; i < 24 && !offer; i++) {
    offer = await page
      .eval(`(() => {
        const panel = document.getElementById("notif-panel");
        const footer = panel && panel.querySelector(":scope > div:last-child");
        const b = footer && footer.querySelector("button");
        return b ? b.textContent.trim() : null;
      })()`)
      .catch(() => null);
    if (!offer) await sleep(250);
  }
  check(
    "panel footer offers the push switch",
    /alertes push|push alerts|الإشعارات الفورية/.test(offer || ""),
    JSON.stringify(offer)
  );

  if (offer) {
    await page.eval(`(() => {
      const panel = document.getElementById("notif-panel");
      const footer = panel.querySelector(":scope > div:last-child");
      footer.querySelector("button").click();
    })()`);
  }

  let onText = null;
  for (let i = 0; i < 80 && !onText; i++) {
    const txt = await footerText().catch(() => "");
    if (/Désactiver|Turn off|إيقاف/.test(txt)) onText = txt;
    else await sleep(300);
  }
  check(
    "toggle subscribes and lands in the ON state",
    !!onText,
    onText ? `footer: ${onText}` : `footer stayed: ${JSON.stringify(await footerText().catch(() => "?"))}`
  );
  await page.screenshot({ path: `${OUT}/bell-push-on.jpg`, quality: 85 });

  // ---- 4. server half: a real encrypted push to THIS browser -------------
  const child = await runTsx(["scripts/push-dispatch.ts"]);
  const line = (child.out.split(/\r?\n/).find((l) => l.startsWith("RESULT ")) || "").slice(7);
  let push = null;
  try {
    push = line ? JSON.parse(line) : null;
  } catch {
    push = null;
  }
  if (!push) {
    check(
      "push dispatcher ran",
      false,
      `exit=${child.code} out=${child.out.slice(-160)} err=${child.err.slice(-300)}`
    );
  } else {
    check("server sees the browser's subscription", push.subsBefore >= 1, JSON.stringify(push));
    check(
      "encrypted push accepted by the push service",
      !!push.first && push.first.sent >= 1,
      JSON.stringify(push.first)
    );
    check("owed row stamped pushedAt", !!push.pushedAt, push.pushedAt || "still NULL");
    check(
      "re-dispatch sends nothing (idempotent)",
      !!push.second && push.second.sent === 0,
      JSON.stringify(push.second)
    );
  }

  // ---- 5. switch back off -------------------------------------------------
  await page.eval(`(() => {
    const panel = document.getElementById("notif-panel");
    const footer = panel && panel.querySelector(":scope > div:last-child");
    const b = footer && footer.querySelector("button");
    if (b) b.click();
  })()`);
  let offText = null;
  for (let i = 0; i < 30 && !offText; i++) {
    const txt = await footerText().catch(() => "");
    if (/Activer les alertes|Enable push|تفعيل الإشعارات/.test(txt)) offText = txt;
    else await sleep(300);
  }
  check(
    "switching push off returns the enable state",
    !!offText,
    offText ? `footer: ${offText}` : `footer stayed: ${JSON.stringify(await footerText().catch(() => "?"))}`
  );

  await page.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\nTOTAL: ${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
