// End-to-end check of the post-login redirect: fill the real form, submit it,
// and report where the browser actually lands. This is the only honest way to
// test it — the target is chosen inside a server action, so poking the NextAuth
// callback endpoint directly would bypass homePathFor() entirely.
// Usage: node .taste-skill/probe-redirect.mjs
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const base = "http://localhost:3100";
const PASSWORD = "password123";

const CASES = [
  { label: "admin, no from", email: "admin@campus.ma", from: null, expect: "/admin" },
  { label: "organizer, no from", email: "organiser@campus.ma", from: null, expect: "/organizer" },
  { label: "student, no from", email: "student@campus.ma", from: null, expect: "/dashboard" },
  { label: "flow-tester, no from", email: "flow-tester@campus.ma", from: null, expect: "/dashboard" },
  { label: "student, from=/events", email: "student@campus.ma", from: "/events", expect: "/events" },
  { label: "admin, from=/dashboard", email: "admin@campus.ma", from: "/dashboard", expect: "/dashboard" },
  // `from` must not be honoured as an absolute / protocol-relative URL.
  { label: "student, from=//evil.com", email: "student@campus.ma", from: "//evil.com", expect: "/dashboard" },
  { label: "student, from=https://evil.com", email: "student@campus.ma", from: "https://evil.com", expect: "/dashboard" },
];

const browser = await Browser.launch();
const results = [];
try {
  for (const c of CASES) {
    const page = await browser.newPage({ width: 1440, height: 900, dsf: 1 });
    try {
      await page.send("Network.clearBrowserCookies");
      const href = c.from ? `${base}/login?from=${encodeURIComponent(c.from)}` : `${base}/login`;
      await page.goto(href, { timeoutMs: 30000, settleMs: 600 });
      await sleep(400);

      await page.eval(`(() => {
        const set = (sel, v) => { const el = document.querySelector(sel); el.value = v; };
        set('#email', ${JSON.stringify(c.email)});
        set('#password', ${JSON.stringify(PASSWORD)});
        document.querySelector('form').requestSubmit();
        return true;
      })()`);

      // Wait for the server action's redirect to land.
      let landed = null;
      for (let i = 0; i < 40; i++) {
        await sleep(250);
        const path = await page.eval("location.pathname");
        if (path && path !== "/login") { landed = path; break; }
      }
      const finalPath = landed ?? (await page.eval("location.pathname"));
      const error = await page
        .eval(`(() => { const a = document.querySelector('[role="alert"]');
                       return a ? a.innerText.trim() : null; })()`)
        .catch(() => null);

      results.push({
        label: c.label,
        expect: c.expect,
        got: finalPath,
        pass: finalPath === c.expect,
        ...(error ? { error } : {}),
      });
    } catch (e) {
      results.push({ label: c.label, expect: c.expect, got: "THREW", pass: false, error: String(e.message || e) });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.label.padEnd(26)} expect ${r.expect.padEnd(12)} got ${r.got}${r.error ? `  [${r.error}]` : ""}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} redirect cases pass`);
