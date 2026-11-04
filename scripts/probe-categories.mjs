/**
 * Categories admin E2E — the add form + the two-step delete.
 *
 * Contract asserted here:
 *   - /admin/categories renders for the admin (FR UI)
 *   - the create input carries its aria-label (placeholder is not a label)
 *   - creating via the form lands the row
 *   - the delete OPENER only ARMS the confirm step: the row survives the
 *     first click (one misclick must not remove a category)
 *   - the confirm button names the row (deleteConfirm {name}), the cancel
 *     button disarms without deleting, re-arm works
 *   - only the confirm click fires the action and the row disappears
 *
 * Fixture self-cleans (create → delete → prisma scrub of the row + its
 * audit rows) so smoke counts stay pristine; a scrub at start means an
 * aborted previous run starts clean too.
 *
 * UI language is French (Chromium Accept-Language=fr).
 * Usage: node scripts/probe-categories.mjs   (prod server on :3100)
 */
import { readFileSync } from "node:fs";
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const PROBE_NAME = `probe-cat-${Date.now()}`;

const FR_AddTitle = "Ajouter une catégorie";
const FR_NameLabel = "Nom de la catégorie";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

// ---- Fixture + cleanup -------------------------------------------------
async function prismaClient() {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)="?(.*?)"?$/);
    if (m) process.env[m[1]] ??= m[2];
  }
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

/** Remove the probe category + every audit row it wrote. */
async function scrub() {
  const p = await prismaClient();
  try {
    const gone = await p.category.deleteMany({ where: { name: PROBE_NAME } });
    const rows = await p.auditLog.deleteMany({
      where: { targetLabel: { startsWith: PROBE_NAME } },
    });
    return { gone: gone.count, rows: rows.count };
  } finally {
    await p.$disconnect();
  }
}

// ---- House helpers -----------------------------------------------------
const sleep_ = sleep;
const waitFor = async (fn, tries = 40, step = 250) => {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await sleep_(step);
  }
  return null;
};

const fillInput = (page, sel, value) =>
  page.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) throw new Error("no element: " + ${JSON.stringify(sel)});
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);

/** Read the probe row's state: does it exist, is the confirm armed? */
const readRow = (page) =>
  page.eval(`(() => {
    const li = Array.from(document.querySelectorAll("li")).find(
      (x) => x.textContent.includes(${JSON.stringify(PROBE_NAME)})
    );
    if (!li) return { row: false };
    const btns = Array.from(li.querySelectorAll("button"));
    const confirmBtn = btns.find((b) => b.textContent.includes(${JSON.stringify(PROBE_NAME)}));
    const opener = btns.find(
      (b) => b.classList.contains("btn-danger") && b !== confirmBtn
    );
    const cancel = btns.find((b) => b.classList.contains("btn-secondary"));
    return {
      row: true,
      opener: !!opener,
      confirm: !!confirmBtn,
      confirmText: confirmBtn ? confirmBtn.textContent.trim() : "",
      pending: confirmBtn ? confirmBtn.disabled : false,
      cancel: !!cancel,
    };
  })()`);

const clickIn = (page, which) =>
  page.eval(`(() => {
    const li = Array.from(document.querySelectorAll("li")).find(
      (x) => x.textContent.includes(${JSON.stringify(PROBE_NAME)})
    );
    if (!li) throw new Error("row gone");
    const btns = Array.from(li.querySelectorAll("button"));
    const confirmBtn = btns.find((b) => b.textContent.includes(${JSON.stringify(PROBE_NAME)}));
    const opener = btns.find(
      (b) => b.classList.contains("btn-danger") && b !== confirmBtn
    );
    const el =
      ${JSON.stringify(which)} === "confirm"
        ? confirmBtn
        : ${JSON.stringify(which)} === "cancel"
          ? btns.find((b) => b.classList.contains("btn-secondary"))
          : opener;
    if (!el) throw new Error("no button: " + ${JSON.stringify(which)});
    el.click();
    return true;
  })()`);

async function login(page, email) {
  await page.send("Network.clearBrowserCookies");
  await page.goto(`${origin}/login`);
  await fillInput(page, 'input[name="email"]', email);
  await fillInput(page, 'input[name="password"]', "password123");
  await page.eval(`document.querySelector("form .btn-primary")?.click()`);
  for (let i = 0; i < 32; i++) {
    const r = await page.send("Network.getCookies", { urls: [origin] });
    const names = (r.cookies ?? []).map((c) => c.name);
    if (names.includes("authjs.session-token") || names.includes("__Host-next-auth.session-token")) {
      return true;
    }
    await sleep(250);
  }
  throw new Error(`login failed for ${email}`);
}

// ---- The run -----------------------------------------------------------
const browser = await Browser.launch();
let exitCode = 0;
try {
  await scrub();
  const page = await browser.newPage({ width: 1280, height: 900 });
  try {
    await login(page, "admin@campus.ma");
    await page.goto(`${origin}/admin/categories`);
    await sleep(600);

    const title = await page.eval(
      `document.querySelector("h2")?.textContent?.trim() ?? ""`
    );
    check("categories page renders for the admin", title === FR_AddTitle, `h2="${title}"`);

    const label = await page.eval(
      `document.querySelector('input[name="name"]')?.getAttribute("aria-label") ?? ""`
    );
    check("create input carries an aria-label", label === FR_NameLabel, `aria-label="${label}"`);

    // Create through the form.
    await fillInput(page, 'input[name="name"]', PROBE_NAME);
    await page.eval(
      `document.querySelector('form:has(input[name="name"]) button')?.click()`
    );
    const created = await waitFor(async () => (await readRow(page)).row);
    check("create form lands the row", !!created, `row for ${PROBE_NAME} ${created ? "visible" : "never appeared"}`);

    // Arm: first click must NOT delete.
    await clickIn(page, "opener");
    const armed = await waitFor(async () => (await readRow(page)).confirm);
    const afterArm = await readRow(page);
    check(
      "opener only arms the confirm step",
      !!armed && afterArm.row,
      `confirm=${afterArm.confirm} rowStillThere=${afterArm.row}`
    );
    check(
      "confirm button names the row",
      afterArm.confirmText.includes(PROBE_NAME),
      `confirmText="${afterArm.confirmText}"`
    );
    check("cancel button offered beside confirm", afterArm.cancel, `cancel=${afterArm.cancel}`);

    // Cancel disarms without deleting.
    await clickIn(page, "cancel");
    const afterCancel = await waitFor(async () => {
      const s = await readRow(page);
      return s.row && !s.confirm ? s : null;
    });
    check(
      "cancel disarms without deleting",
      !!afterCancel && afterCancel.row,
      `row=${afterCancel?.row} confirm=${afterCancel?.confirm}`
    );

    // Re-arm, then confirm for real.
    await clickIn(page, "opener");
    const rearmed = await waitFor(async () => (await readRow(page)).confirm);
    check("confirm step re-arms", !!rearmed, `confirm=${rearmed}`);

    await clickIn(page, "confirm");
    const gone = await waitFor(async () => !(await readRow(page)).row, 60, 250);
    check("confirm fires the delete", !!gone, `row gone=${gone}`);
  } finally {
    await page.close();
  }
} catch (err) {
  console.error("probe crashed:", err);
  exitCode = 1;
} finally {
  await browser.close();
  const { gone, rows } = await scrub();
  console.log(`fixture cleaned: category rows=${gone}, audit rows=${rows}`);
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\nTOTAL: ${results.length - failed} passed, ${failed} failed`);
if (failed > 0) exitCode = 1;
process.exit(exitCode);
